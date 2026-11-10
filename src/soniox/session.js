import { RealtimeUtteranceBuffer, SonioxNodeClient } from "@soniox/node";
import { PassThrough } from "stream";
import { createLogger } from "../logger.js";

const log = createLogger("soniox");

// Translation tokens arrive after their original tokens and can lag behind the
// endpoint. When an endpoint arrives before the translation, hold the utterance
// until the translation shows up (or the next speech starts), up to this long.
const TRANSLATION_WAIT_MS = 2500;
// Once translation tokens are flowing, flush if no more arrive within this window.
const TRANSLATION_IDLE_MS = 700;

const isTranslation = (t) => t.translation_status === "translation";

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

  const session = client.realtime.stt(config);
  const buffer = new RealtimeUtteranceBuffer();
  const audioStream = new PassThrough();

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

  // Partial state (accumulated final tokens of the current utterance)
  let finalOriginal = "";
  let finalTranslated = "";
  let partialSpeaker = null;

  // Endpoint / translation tracking
  let awaitingTranslation = false; // last final token is an original still waiting for its translation
  let pendingEndpoint = false;
  let flushTimer = null;

  function flush(isFinal) {
    clearTimeout(flushTimer);
    flushTimer = null;
    pendingEndpoint = false;
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

  session.on("result", (result) => {
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
  });

  session.on("endpoint", () => {
    if (awaitingTranslation) {
      pendingEndpoint = true;
      scheduleFlush(TRANSLATION_WAIT_MS);
    } else {
      flush(false);
    }
  });

  session.on("finished", () => flush(true));

  return {
    session,
    buffer,
    audioStream,
    config,

    async connect() {
      log.info("Connecting to Soniox", { model: config.model, targetLanguage, languageHints });
      await session.connect();
      log.info("Soniox connected");
    },

    async startStreaming() {
      // sendStream will read from the PassThrough and send audio to Soniox
      // We don't set finish:true because the stream is continuous
      session.sendStream(audioStream, { pace_ms: 0 }).catch(() => {
        // Stream ended or error — handled by session error event
      });
    },

    sendAudio(chunk) {
      audioStream.write(chunk);
    },

    async stop() {
      audioStream.end();
      await session.finish();
    },

    onUtterance(callback) {
      utteranceListeners.push(callback);
    },

    onPartial(callback) {
      partialListeners.push(callback);
    },

    onError(callback) {
      session.on("error", (err) => {
        log.error("Soniox session error", err);
        clearTimeout(flushTimer);
        callback(err);
      });
    },
  };
}
