import { RealtimeUtteranceBuffer, SonioxNodeClient } from "@soniox/node";
import { PassThrough } from "stream";
import { createLogger } from "../logger.js";

const log = createLogger("soniox");

export function createSession({ targetLanguage = "vi", languageHints = ["en"], apiKey, context = null } = {}) {
  const clientOpts = apiKey ? { api_key: apiKey } : {};
  const client = new SonioxNodeClient(clientOpts);
  const config = {
    model: "stt-rt-v6",
    audio_format: "pcm_s16le",
    sample_rate: 16000,
    num_channels: 1,
    language_hints: languageHints,
    enable_language_identification: true,
    enable_speaker_diarization: true,
    enable_endpoint_detection: true,
    translation: {
      type: "one_way",
      target_language: targetLanguage,
    },
  };

  if (context) {
    config.context = { text: context };
  }

  const session = client.realtime.stt(config);
  const buffer = new RealtimeUtteranceBuffer();
  const audioStream = new PassThrough();

  function parseUtterance(utterance) {
    const results = [];
    for (const segment of utterance.segments) {
      const isTranslation = segment.tokens[0]?.translation_status === "translation";
      results.push({
        speaker: segment.speaker || null,
        language: segment.language || null,
        text: segment.text.trimStart(),
        isTranslation,
      });
    }

    // Group original + translation pairs
    const originals = results.filter((r) => !r.isTranslation);
    const translations = results.filter((r) => r.isTranslation);

    return {
      originalText: originals.map((r) => r.text).join(" "),
      originalLanguage: originals[0]?.language || null,
      translatedText: translations.map((r) => r.text).join(" "),
      translationLanguage: translations[0]?.language || null,
      speaker: originals[0]?.speaker || translations[0]?.speaker || null,
      timestamp: new Date().toISOString(),
    };
  }

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
      session.on("endpoint", () => {
        const utterance = buffer.markEndpoint();
        if (utterance) {
          callback(parseUtterance(utterance), false);
        }
      });

      session.on("finished", () => {
        const utterance = buffer.markEndpoint();
        if (utterance) {
          callback(parseUtterance(utterance), true);
        }
      });
    },

    onPartial(callback) {
      let finalOriginal = "";
      let finalTranslated = "";
      let speaker = null;

      session.on("result", (result) => {
        buffer.addResult(result);

        const tokens = result.tokens || [];
        if (tokens.length === 0) return;

        // Single-pass: classify tokens and build strings directly
        let fOrig = "", fTrans = "", nfOrig = "", nfTrans = "", s = null;
        for (const t of tokens) {
          if (t.speaker && !s) s = t.speaker;
          const isTrans = t.translation_status === "translation";
          if (t.is_final) {
            if (isTrans) fTrans += t.text; else fOrig += t.text;
          } else {
            if (isTrans) nfTrans += t.text; else nfOrig += t.text;
          }
        }

        finalOriginal += fOrig;
        finalTranslated += fTrans;
        if (s) speaker = s;

        callback({
          originalText: finalOriginal + nfOrig,
          translatedText: finalTranslated + nfTrans,
          speaker,
        });
      });

      // Reset when utterance is finalized
      session.on("endpoint", () => {
        finalOriginal = "";
        finalTranslated = "";
        speaker = null;
      });
      session.on("finished", () => {
        finalOriginal = "";
        finalTranslated = "";
        speaker = null;
      });
    },

    onError(callback) {
      session.on("error", (err) => {
        log.error("Soniox session error", err);
        callback(err);
      });
    },
  };
}
