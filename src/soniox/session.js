import { RealtimeUtteranceBuffer, SonioxNodeClient } from "@soniox/node";
import { createLogger } from "../logger.js";

const log = createLogger("soniox");

// Translation tokens arrive after their original tokens and can lag behind the
// endpoint. When an endpoint arrives before the translation, hold the utterance
// until the translation shows up (or the next speech starts), up to this long.
const TRANSLATION_WAIT_MS = 2500;
// Once translation tokens are flowing, flush if no more arrive within this window.
const TRANSLATION_IDLE_MS = 700;

// Soniox closes a stream after 20 s without audio or keepalive (pause, stalled capture).
const KEEPALIVE_IDLE_MS = 8000;
// Soniox ends streams on its own (503 "please restart", network drops, 300-minute cap):
// open a new one and keep going. Backoff per consecutive failed attempt.
const RECONNECT_DELAYS_MS = [0, 1000, 2000, 5000, 10000];
// A dead stream keeps its concurrency slot until the 20 s timeout frees it.
const RATE_LIMIT_DELAY_MS = 21000;
// Audio captured while reconnecting is sent once the new stream is up (16 kHz s16le mono).
const MAX_PENDING_AUDIO_BYTES = 16000 * 2 * 10;

const isTranslation = (t) => t.translation_status === "translation";
// Bad API key or exhausted balance: reconnecting can't help.
const isFatal = (err) => err?.statusCode === 401 || err?.statusCode === 402;
const isRateLimited = (err) => err?.statusCode === 429;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function createSession({ targetLanguage = "vi", languageHints = [], apiKey, context = null } = {}) {
  const clientOpts = apiKey ? { api_key: apiKey } : {};
  const client = new SonioxNodeClient(clientOpts);
  const config = {
    model: "stt-rt-v6",
    audio_format: "pcm_s16le",
    sample_rate: 16000,
    num_channels: 1,
    enable_language_identification: true,
    enable_speaker_diarization: true,
    enable_endpoint_detection: true,
    translation: {
      type: "one_way",
      target_language: targetLanguage,
    },
  };

  if (languageHints.length > 0) {
    config.language_hints = languageHints;
  }

  if (context) {
    config.context = { text: context };
  }

  const buffer = new RealtimeUtteranceBuffer();

  // Classify per token: the SDK groups segments by speaker + language only, so
  // original Vietnamese speech and Vietnamese translation tokens can share a segment.
  function parseUtterance(utterance) {
    let originalText = "";
    let translatedText = "";
    let speaker = null;
    let translationLanguage = null;
    const langChars = {};

    for (const t of utterance.tokens) {
      if (isTranslation(t)) {
        translatedText += t.text;
        translationLanguage ??= t.language || null;
      } else {
        originalText += t.text;
        speaker ??= t.speaker || null;
        if (t.language) langChars[t.language] = (langChars[t.language] || 0) + t.text.length;
      }
    }

    const originalLanguage = Object.keys(langChars).sort((a, b) => langChars[b] - langChars[a])[0] || null;

    return {
      originalText: originalText.trim(),
      originalLanguage,
      translatedText: translatedText.trim(),
      translationLanguage,
      speaker: speaker || utterance.tokens.find((t) => t.speaker)?.speaker || null,
      timestamp: new Date().toISOString(),
    };
  }

  const utteranceListeners = [];
  const partialListeners = [];
  const errorListeners = [];
  const reconnectListeners = [];

  // Partial state (accumulated final tokens of the current utterance)
  let finalOriginal = "";
  let finalTranslated = "";
  let partialSpeaker = null;

  // Endpoint / translation tracking
  let awaitingTranslation = false; // last final token is an original still waiting for its translation
  let pendingEndpoint = false;
  let flushTimer = null;

  // Connection state: `session` is the live Soniox stream, null while reconnecting
  let session = null;
  let stopping = false;
  let dead = false; // fatal error: no reconnect, drop audio
  let reconnecting = false;
  let reconnectAttempt = 0;
  let pendingAudio = [];
  let pendingAudioBytes = 0;
  let lastSentAt = 0;
  let keepaliveTimer = null;

  function flush(isFinal) {
    clearTimeout(flushTimer);
    flushTimer = null;
    pendingEndpoint = false;
    awaitingTranslation = false;
    finalOriginal = "";
    finalTranslated = "";
    partialSpeaker = null;
    const utterance = buffer.markEndpoint();
    if (!utterance) return;
    const parsed = parseUtterance(utterance);
    for (const fn of utteranceListeners) fn(parsed, isFinal);
  }

  function scheduleFlush(ms) {
    clearTimeout(flushTimer);
    flushTimer = setTimeout(() => flush(false), ms);
  }

  function ingest(tokens, result) {
    if (tokens.length === 0) return;
    buffer.addResult({ ...result, tokens });
    for (const t of tokens) {
      if (!t.is_final) continue;
      awaitingTranslation = t.translation_status === "original";
      if (isTranslation(t)) finalTranslated += t.text;
      else finalOriginal += t.text;
      if (t.speaker && !partialSpeaker) partialSpeaker = t.speaker;
    }
  }

  function handleResult(result) {
    const tokens = result.tokens || [];
    if (tokens.length === 0) return;

    if (pendingEndpoint) {
      // After an endpoint every original token is already final, so any new final
      // non-translation token is the start of the next utterance.
      const nextIdx = tokens.findIndex((t) => t.is_final && !isTranslation(t));
      if (nextIdx !== -1) {
        ingest(tokens.slice(0, nextIdx), result);
        flush(false);
        ingest(tokens.slice(nextIdx), result);
      } else {
        ingest(tokens, result);
        if (tokens.some((t) => t.is_final && isTranslation(t))) scheduleFlush(TRANSLATION_IDLE_MS);
      }
    } else {
      ingest(tokens, result);
    }

    let nfOrig = "";
    let nfTrans = "";
    for (const t of tokens) {
      if (t.is_final) continue;
      if (isTranslation(t)) nfTrans += t.text;
      else nfOrig += t.text;
    }

    const partial = {
      originalText: finalOriginal + nfOrig,
      translatedText: finalTranslated + nfTrans,
      speaker: partialSpeaker,
    };
    for (const fn of partialListeners) fn(partial);
  }

  function handleEndpoint() {
    if (awaitingTranslation) {
      pendingEndpoint = true;
      scheduleFlush(TRANSLATION_WAIT_MS);
    } else {
      flush(false);
    }
  }

  function fail(err) {
    dead = true;
    stopKeepalive();
    pendingAudio = [];
    pendingAudioBytes = 0;
    for (const fn of errorListeners) fn(err);
  }

  function notifyReconnect(state, detail) {
    for (const fn of reconnectListeners) fn(state, detail);
  }

  // Events from a stream that has been replaced are ignored.
  function openStream() {
    const s = client.realtime.stt(config);
    let gotResult = false;
    s.on("result", (result) => {
      if (s !== session) return;
      if (!gotResult) {
        gotResult = true;
        reconnectAttempt = 0;
      }
      handleResult(result);
    });
    s.on("endpoint", () => { if (s === session) handleEndpoint(); });
    s.on("finished", () => {
      if (s !== session) return;
      if (stopping) flush(true);
      else handleDrop(s, null, "finished");
    });
    s.on("error", (err) => {
      if (s !== session || stopping) return;
      log.error("Soniox session error", err);
      handleDrop(s, err);
    });
    s.on("disconnected", (reason) => {
      if (s !== session || stopping) return;
      handleDrop(s, null, reason);
    });
    return s;
  }

  // The stream ended while we still want audio transcribed (the SDK closes quietly
  // on some server-side closes, so "disconnected" counts as well as "error").
  function handleDrop(s, err, reason) {
    if (s !== session || stopping) return;
    session = null;
    try { s.close(); } catch { /* already closed */ }
    // Deliver what was already recognized; a new stream starts with an empty context.
    flush(false);

    if (isFatal(err)) {
      fail(err);
      return;
    }
    log.warn("Soniox stream ended unexpectedly, reconnecting", { reason: reason || null, error: err?.message || null });
    notifyReconnect("reconnecting", err?.message || reason || "");
    reconnect(err);
  }

  async function reconnect(cause) {
    if (reconnecting) return;
    reconnecting = true;
    let lastErr = cause;
    try {
      while (!stopping) {
        const delay = isRateLimited(lastErr)
          ? RATE_LIMIT_DELAY_MS
          : RECONNECT_DELAYS_MS[Math.min(reconnectAttempt, RECONNECT_DELAYS_MS.length - 1)];
        reconnectAttempt++;
        if (delay) await sleep(delay);
        if (stopping) return;

        const s = openStream();
        try {
          await s.connect();
        } catch (err) {
          log.warn("Soniox reconnect failed", { attempt: reconnectAttempt, error: err.message });
          lastErr = err;
          if (isFatal(err)) {
            fail(err);
            return;
          }
          continue;
        }
        if (stopping) {
          s.close();
          return;
        }
        session = s;
        sendPendingAudio();
        log.info("Soniox reconnected", { attempt: reconnectAttempt });
        notifyReconnect("reconnected");
        return;
      }
    } finally {
      reconnecting = false;
    }
  }

  function send(chunk) {
    session.sendAudio(chunk);
    lastSentAt = Date.now();
  }

  function sendPendingAudio() {
    const chunks = pendingAudio;
    pendingAudio = [];
    pendingAudioBytes = 0;
    try {
      for (const chunk of chunks) send(chunk);
    } catch {
      // Stream died again — its error/disconnected event triggers another reconnect
    }
  }

  function queueAudio(chunk) {
    pendingAudio.push(chunk);
    pendingAudioBytes += chunk.length;
    while (pendingAudioBytes > MAX_PENDING_AUDIO_BYTES && pendingAudio.length > 1) {
      pendingAudioBytes -= pendingAudio.shift().length;
    }
  }

  // Paused capture or a stalled device sends no audio; keep the stream alive.
  function startKeepalive() {
    keepaliveTimer = setInterval(() => {
      if (!session || Date.now() - lastSentAt < KEEPALIVE_IDLE_MS) return;
      session.keepAlive();
      lastSentAt = Date.now();
    }, KEEPALIVE_IDLE_MS / 2);
  }

  function stopKeepalive() {
    clearInterval(keepaliveTimer);
    keepaliveTimer = null;
  }

  return {
    config,

    async connect() {
      log.info("Connecting to Soniox", { model: config.model, targetLanguage, languageHints });
      const s = openStream();
      session = s;
      try {
        await s.connect();
      } catch (err) {
        session = null;
        throw err;
      }
      lastSentAt = Date.now();
      log.info("Soniox connected");
    },

    async startStreaming() {
      startKeepalive();
    },

    sendAudio(chunk) {
      if (stopping || dead) return;
      if (!session || session.state !== "connected") {
        queueAudio(chunk);
        return;
      }
      try {
        send(chunk);
      } catch {
        // Stream died between checks — keep the chunk for the next stream
        queueAudio(chunk);
      }
    },

    async stop() {
      if (stopping) return;
      stopping = true;
      stopKeepalive();
      pendingAudio = [];
      pendingAudioBytes = 0;
      const s = session;
      if (s?.state === "connected") {
        try {
          await s.finish();
          return;
        } catch {
          // Fall through: deliver what we have
        }
      }
      if (s) s.close();
      flush(true);
    },

    onUtterance(callback) {
      utteranceListeners.push(callback);
    },

    onPartial(callback) {
      partialListeners.push(callback);
    },

    onError(callback) {
      errorListeners.push(callback);
    },

    // callback(state, detail): "reconnecting" when a stream drops, "reconnected" once audio flows again
    onReconnect(callback) {
      reconnectListeners.push(callback);
    },
  };
}
