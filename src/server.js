import "dotenv/config";
import express from "express";
import compression from "compression";
import { createServer } from "http";
import { Server } from "socket.io";
import { fileURLToPath } from "url";
import { createRequire } from "module";
import path from "path";
import { existsSync } from "fs";

import apiRoutes from "./routes/api.js";
import { loadSettings } from "./storage/settings.js";
import { createLogger } from "./logger.js";
import { apiError, ErrorCodes } from "./errors.js";

const log = createLogger("server");

// Set FFMPEG_PATH from ffmpeg-static when not already set (Electron sets it in main.js)
if (!process.env.FFMPEG_PATH) {
  try {
    const require = createRequire(import.meta.url);
    process.env.FFMPEG_PATH = require("ffmpeg-static");
  } catch {
    // ffmpeg-static not installed — fall back to system ffmpeg
  }
}

// Add ffmpeg directory to PATH so subprocesses (Python whisper etc.) can find it
if (process.env.FFMPEG_PATH) {
  const ffmpegDir = path.dirname(process.env.FFMPEG_PATH);
  process.env.PATH = `${ffmpegDir}${path.delimiter}${process.env.PATH}`;
}

// Set AUDIOCAP_PATH for web dev mode (Electron sets it in main.js)
if (!process.env.AUDIOCAP_PATH) {
  const base = path.dirname(fileURLToPath(import.meta.url));
  const candidates = process.platform === "darwin"
    ? [
        path.join(base, "../swift-audiocap/.build/apple/Products/Release/audiocap"),
        path.join(base, "../swift-audiocap/.build/release/audiocap"),
        path.join(base, "../audiocap-bin/mac/audiocap"),
      ]
    : process.platform === "win32"
    ? [
        path.join(base, "../wasapi-audiocap/bin/Release/net8.0/win-x64/publish/audiocap.exe"),
        path.join(base, "../audiocap-bin/win/audiocap.exe"),
      ]
    : [];
  const found = candidates.find(existsSync);
  if (found) process.env.AUDIOCAP_PATH = found;
}

// Lazy-loaded modules — cache the Promise itself so concurrent callers share one load
let _historyP, _sonioxP, _captureP, _whisperP, _diarizeP, _devicesP;

function getHistory() {
  if (!_historyP) _historyP = import("./storage/history.js");
  return _historyP;
}
function getSonioxSession() {
  if (!_sonioxP) _sonioxP = import("./soniox/session.js").then((m) => m.createSession);
  return _sonioxP;
}
function getCapture() {
  if (!_captureP) _captureP = import("./audio/capture.js");
  return _captureP;
}
function getWhisperSession() {
  if (!_whisperP) _whisperP = import("./local/whisper-session.js").then((m) => m.createSession);
  return _whisperP;
}
function getDiarizeSession() {
  if (!_diarizeP) _diarizeP = import("./local/diarize-session.js").then((m) => m.createSession);
  return _diarizeP;
}
function getDevices() {
  if (!_devicesP) _devicesP = import("./audio/devices.js");
  return _devicesP;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const server = createServer(app);
const io = new Server(server);

app.use(compression());
app.use(express.json());
app.use(express.static(path.join(__dirname, "../dist"), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith(".html")) {
      res.set("Cache-Control", "no-store");
    }
  },
}));
app.use("/api", apiRoutes);

// Last-resort error handler: any route error (sync or rejected promise) becomes a JSON error
// the UI can show, instead of an HTML stack trace or a hung request.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  log.error(`Request failed: ${req.method} ${req.originalUrl}`, err);
  if (res.headersSent) return res.end();
  const status = err.status || err.statusCode || 500;
  const code = typeof err.code === "string" ? err.code
    : status < 500 ? ErrorCodes.INVALID_INPUT
    : ErrorCodes.INTERNAL_ERROR;
  apiError(res, status, code,
    err.expose === false ? "Internal server error" : (err.message || "Internal server error"));
});

// Active sessions per socket
const activeSessions = new Map();
const SESSION_TTL = 4 * 60 * 60 * 1000; // 4 hours max session

// Periodic cleanup of stale sessions (safety net for dropped connections)
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [socketId, state] of activeSessions) {
    if (state.startedAt && now - state.startedAt > SESSION_TTL) {
      log.warn("Cleaning up stale session", { socketId, sessionId: state.dbSessionId });
      stopSession(socketId).catch(() => {});
    }
  }
}, 60_000);

// Log and emit an error event to the client in one call
function emitError(socket, payload) {
  log.warn(`Emit error: ${payload.key || payload.message}`, { socketId: socket.id, ...payload.params && { params: payload.params } });
  socket.emit("error", payload);
}

io.on("connection", (socket) => {
  log.info("Client connected", { socketId: socket.id });

  // Every handler is guarded: a failure is logged and reported to this client
  // instead of escaping as an uncaught exception / unhandled rejection.
  const on = (event, handler) => socket.on(event, async (...args) => {
    try {
      await handler(...args);
    } catch (err) {
      log.error(`Socket handler "${event}" failed`, err);
      emitError(socket, { message: `${event} failed: ${err?.message || err}` });
    }
  });

  on("start-listening", async (opts) => {
    // Fire-and-forget cleanup of any existing session (captures are stopped synchronously)
    stopSession(socket.id).catch(() => {});

    try {
      const [history, captureModule, devicesModule] = await Promise.all([
        getHistory(), getCapture(), getDevices(),
      ]);
      const { startCapture, startSystemCapture } = captureModule;
      const { listInputDevices, checkAudiocap } = devicesModule;

      const settings = loadSettings();
      const engine = settings.transcriptionEngine || "soniox";

      if (engine === "soniox" && !settings.sonioxApiKey) {
        emitError(socket, { key: "errNoApiKey" });
        return;
      }


      const resumeSessionId = opts?.sessionId;
      const requestedContext = typeof opts?.context === "string" && opts.context.trim() ? opts.context.trim() : null;
      let audioSource, micTargetLanguage, systemTargetLanguage, sessionContext;

      if (resumeSessionId) {
        // Resume existing session and re-use prior context unless overridden
        const existing = history.getSession(resumeSessionId);
        if (!existing || !existing.ended_at) {
          emitError(socket, { key: "errSessionNotFound" });
          return;
        }
        history.reopenSession(resumeSessionId);
        audioSource = existing.audio_source;
        const targetLang = existing.target_language;
        if (targetLang.includes(",")) {
          const [mic, sys] = targetLang.split(",");
          micTargetLanguage = mic;
          systemTargetLanguage = sys;
        } else {
          micTargetLanguage = targetLang;
          systemTargetLanguage = targetLang;
        }
        sessionContext = requestedContext || existing.context || null;
        if (requestedContext && requestedContext !== existing.context) {
          history.updateSessionContext(resumeSessionId, requestedContext);
        }
      } else {
        audioSource = settings.audioSource;
        const targetLanguage = settings.targetLanguage;
        micTargetLanguage = settings.micTargetLanguage ?? targetLanguage;
        systemTargetLanguage = settings.systemTargetLanguage ?? targetLanguage;
        sessionContext = requestedContext || null;
      }

      const languageHints = settings.languageHints || ["en"];

      const sttMode = engine === "local-whisper"
        ? (settings.enableDiarization && settings.hfToken ? "diarize" : "whisper")
        : "soniox";

      // Pre-fetch STT module (resolves while doing device/DB work below)
      const sttFactoryP = sttMode === "diarize" ? getDiarizeSession()
        : sttMode === "whisper" ? getWhisperSession()
        : getSonioxSession();

      // Resolve devices
      const devices = await listInputDevices();
      const isWin = process.platform === "win32";
      const isLinux = process.platform === "linux";
      const micIndex = settings.micDeviceIndex ?? 0;
      const micDevice = devices.find((d) => d.index === micIndex);

      // On Windows/Linux, capture needs device name; on macOS, avfoundation uses index
      const micCaptureDev = (isWin || isLinux) ? micDevice?.name : micIndex;

      // System audio: native capture via audiocap (ScreenCaptureKit on macOS, WASAPI on Windows)
      // On Linux, audiocap is not available — fall back to ffmpeg + PulseAudio monitor source
      const audiocapAvailable = !isLinux && await checkAudiocap();
      const useAudiocap = audiocapAvailable && (audioSource === "system" || audioSource === "both");

      // Linux fallback: auto-detect PulseAudio monitor loopback device
      let systemCaptureDev = null;
      if (isLinux && (audioSource === "system" || audioSource === "both")) {
        const systemIndex = settings.systemDeviceIndex;
        if (systemIndex != null) {
          const systemDevice = devices.find((d) => d.index === systemIndex);
          if (systemDevice) {
            systemCaptureDev = systemDevice.name;
          } else {
            emitError(socket, { key: "errSystemDeviceNotFound", params: { index: systemIndex } });
          }
        } else {
          // Auto-detect PulseAudio monitor source
          const loopback = devices.find((d) => /\.monitor$/i.test(d.name));
          if (loopback) {
            systemCaptureDev = loopback.name;
          } else {
            emitError(socket, { key: "errNoLoopbackLinux" });
          }
        }
      }

      if ((audioSource === "system" || audioSource === "both") && !useAudiocap && !isLinux) {
        emitError(socket, { key: "errAudiocapNotFound" });
      }

      const deviceName = micDevice?.name || `Device ${micIndex}`;

      // Create or reuse history session
      let dbSessionId;
      if (resumeSessionId) {
        dbSessionId = resumeSessionId;
      } else {
        const historyTargetLang = audioSource === "both" && micTargetLanguage !== systemTargetLanguage
          ? `${micTargetLanguage},${systemTargetLanguage}`
          : (audioSource === "system" ? systemTargetLanguage : micTargetLanguage);
        dbSessionId = history.createSession(audioSource, historyTargetLang, deviceName, sessionContext);
      }

      log.info("Session starting", {
        socketId: socket.id,
        sessionId: dbSessionId,
        engine: sttMode,
        source: audioSource,
        micLang: micTargetLanguage,
        systemLang: systemTargetLanguage,
        resume: !!resumeSessionId,
      });

      const state = {
        dbSessionId,
        audioSource,
        paused: false,
        captures: [],
        sttSessions: [],
        partialTimers: [],
        startedAt: Date.now(),
      };

      const sources = audioSource === "both"
        ? ["mic", "system"]
        : [audioSource];

      // Register state and ACK the client immediately — STT setup continues below
      activeSessions.set(socket.id, state);
      socket.emit("status", { listening: true, sessionId: dbSessionId, audioSource });

      const createSTT = await sttFactoryP;

      await Promise.all(sources.map(async (source) => {
        const isSystemSource = source === "system";
        const useNativeCapture = isSystemSource && useAudiocap;
        // On Linux, system source uses ffmpeg+pulse with monitor device
        const captureDev = isSystemSource
          ? (isLinux ? systemCaptureDev : null)
          : micCaptureDev;

        if (!useNativeCapture && captureDev == null) {
          emitError(socket, { key: "errNoDevice", params: { source } });
          return;
        }

        // Start audio capture with retry on crash
        let retryCount = 0;
        const MAX_RETRIES = 3;
        let currentCapture = null;

        function launchCapture() {
          currentCapture = useNativeCapture
            ? startSystemCapture()
            : startCapture(captureDev);
          currentCapture.onError((err) => {
            // Screen Recording permission denied — no retry, show specific error
            if (err.message === "SCREEN_RECORDING_PERMISSION_DENIED") {
              emitError(socket, { key: "errScreenRecordingPermission" });
              return;
            }
            emitError(socket, { key: "errAudioCapture", params: { source, detail: err.message } });
            // Retry if session is still active
            if (retryCount < MAX_RETRIES && activeSessions.get(socket.id) === state && !state.paused) {
              retryCount++;
              log.warn(`Capture crashed, retrying (${retryCount}/${MAX_RETRIES})`, { device: captureDev, source });
              setTimeout(() => {
                if (activeSessions.get(socket.id) === state) {
                  launchCapture();
                  // Re-pipe to STT
                  currentCapture.stream.on("data", (chunk) => stt.sendAudio(chunk));
                  state.captures = state.captures.filter((c) => c !== currentCapture);
                  state.captures.push(currentCapture);
                }
              }, 1000 * retryCount);
            }
          });
          return currentCapture;
        }

        const capture = launchCapture();

        // Create STT session
        const sourceTargetLang = source === "mic" ? micTargetLanguage : systemTargetLanguage;
        let stt;
        if (engine === "local-whisper") {
          const sessionOpts = {
            targetLanguage: sourceTargetLang,
            languageHints,
            whisperModel: settings.whisperModel || "base",
            whisperLanguage: source === "mic"
              ? (settings.micWhisperLanguage || "auto")
              : (settings.systemWhisperLanguage || "auto"),
            localTranslationEngine: settings.localTranslationEngine || "none",
            ollamaBaseUrl: settings.ollamaBaseUrl,
            ollamaModel: settings.ollamaModel,
            libreTranslateUrl: settings.libreTranslateUrl,
            context: sessionContext,
          };
          stt = sttMode === "diarize"
            ? createSTT({ ...sessionOpts, hfToken: settings.hfToken })
            : createSTT(sessionOpts);
        } else {
          // Hints only bias recognition. A fixed ["en"] skews mixed ja/vi meetings, so derive
          // them from the chosen source language (plus the target, which is often spoken too);
          // on auto-detect, send none and let Soniox identify the language.
          const sourceLang = source === "mic" ? settings.micWhisperLanguage : settings.systemWhisperLanguage;
          const sonioxHints = sourceLang && sourceLang !== "auto"
            ? [...new Set([sourceLang, sourceTargetLang])]
            : [];
          stt = createSTT({ targetLanguage: sourceTargetLang, languageHints: sonioxHints, apiKey: settings.sonioxApiKey || undefined, context: sessionContext });
        }

        // In "both" mode, prefix speaker IDs with source to avoid collisions
        // between independent STT sessions (e.g. spk_0 from mic vs spk_0 from system)
        const prefixSpeaker = (obj) => {
          if (audioSource !== "both" || !obj.speaker) return obj;
          return { ...obj, speaker: `${source}:${obj.speaker}` };
        };

        // Batch partial results — flush at most every 100ms to reduce message overhead
        let pendingPartial = null;
        let partialTimer = null;
        stt.onPartial((partial) => {
          pendingPartial = { source, ...prefixSpeaker(partial) };
          if (!partialTimer) {
            partialTimer = setTimeout(() => {
              if (pendingPartial) socket.emit("partial-result", pendingPartial);
              pendingPartial = null;
              partialTimer = null;
            }, 100);
          }
        });
        state.partialTimers.push(() => { clearTimeout(partialTimer); partialTimer = null; });

        stt.onUtterance((utterance) => {
          const prefixed = prefixSpeaker(utterance);
          socket.emit("utterance", { source, ...prefixed });
          if (utterance.originalText) {
            history.addUtterance(dbSessionId, { ...prefixed, source });
          }
        });

        stt.onError((err) => {
          const key = engine === "local-whisper" ? "errWhisper" : "errSoniox";
          emitError(socket, { key, params: { detail: err.message } });
        });

        await stt.connect();

        // Abort if session was stopped or replaced while connecting
        if (activeSessions.get(socket.id) !== state) {
          capture.stop();
          stt.stop().catch(() => {});
          return;
        }

        await stt.startStreaming();

        capture.stream.on("data", (chunk) => stt.sendAudio(chunk));
        capture.stream.on("end", () => stt.stop().catch(() => {}));

        state.captures.push(capture);
        state.sttSessions.push(stt);
      }));

      log.info("All sources connected", { socketId: socket.id, sessionId: dbSessionId });
    } catch (err) {
      // Revert to stopped state on failure
      stopSession(socket.id).catch(() => {});
      socket.emit("status", { listening: false });
      const key = err.message?.includes("authenticate") || err.message?.includes("401") || err.message?.includes("Unauthorized")
        ? "errInvalidApiKey"
        : err.message?.includes("ENOTFOUND") || err.message?.includes("ECONNREFUSED")
        ? "errNetwork"
        : "errStartFailed";
      emitError(socket, { key, params: { detail: err.message } });
      log.error("Start error", err);
    }
  });

  on("pause-listening", () => {
    const state = activeSessions.get(socket.id);
    if (!state || state.paused) return;

    for (const capture of state.captures) {
      capture.pause();
    }
    state.paused = true;
    socket.emit("status", { listening: true, paused: true, sessionId: state.dbSessionId, audioSource: state.audioSource });
    log.info("Paused", { socketId: socket.id });
  });

  on("resume-listening", () => {
    const state = activeSessions.get(socket.id);
    if (!state || !state.paused) return;

    for (const capture of state.captures) {
      capture.resume();
    }
    state.paused = false;
    socket.emit("status", { listening: true, paused: false, sessionId: state.dbSessionId, audioSource: state.audioSource });
    log.info("Resumed", { socketId: socket.id });
  });

  on("stop-listening", () => {
    socket.emit("status", { listening: false });
    stopSession(socket.id).catch((err) => log.error("Stop error", err));
  });

  on("disconnect", async () => {
    await stopSession(socket.id);
    log.info("Client disconnected", { socketId: socket.id });
  });
});

async function stopSession(socketId) {
  const state = activeSessions.get(socketId);
  if (!state) return;

  // Remove immediately to prevent double-stop from concurrent disconnect + stop-listening
  activeSessions.delete(socketId);

  log.info("Stopping session", { socketId, sessionId: state.dbSessionId });

  // Clear batched partial timers
  for (const clearTimer of state.partialTimers || []) clearTimer();

  for (const capture of state.captures) {
    capture.stop();
  }

  // End DB session + stop all STT sessions in parallel
  await Promise.all([
    getHistory().then((h) => h.endSession(state.dbSessionId)),
    ...state.sttSessions.map((stt) => stt.stop().catch(() => {})),
  ]);
}

const DEFAULT_PORT = 3333;

function listenOnce(port) {
  return new Promise((resolve, reject) => {
    const onError = (err) => {
      server.off("listening", onListening);
      reject(err);
    };
    const onListening = () => {
      server.off("error", onError);
      resolve(server.address().port);
    };
    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(port);
  });
}

// Turn low-level listen errors into a message a user can act on
function describeListenError(err, port) {
  let message;
  if (err.code === "EADDRINUSE") {
    message = `Port ${port} is already in use by another program (another Node Trans window or a dev server?). ` +
      `Close that program, or start with a different port: PORT=<number>.`;
  } else if (err.code === "EACCES") {
    message = `Not allowed to open port ${port}. Choose a port above 1024: PORT=<number>.`;
  } else {
    message = `Could not start the local server on port ${port}: ${err.message}`;
  }
  const wrapped = new Error(message, { cause: err });
  wrapped.code = err.code;
  return wrapped;
}

/**
 * Start the HTTP + Socket.IO server. Resolves with the port actually used.
 * The port is PORT (env) or 3333. With `allowFallbackPort` (Electron), a busy port
 * falls back to any free port instead of failing — the window loads whatever port we got.
 */
export async function startServer({ allowFallbackPort = false } = {}) {
  loadSettings(); // fail early on a corrupt settings file
  const preferred = Number(process.env.PORT) || DEFAULT_PORT;
  let port;
  try {
    port = await listenOnce(preferred);
  } catch (err) {
    if (err.code !== "EADDRINUSE" || !allowFallbackPort) throw describeListenError(err, preferred);
    log.warn(`Port ${preferred} is in use, using a free port instead`);
    try {
      port = await listenOnce(0);
    } catch (err2) {
      throw describeListenError(err2, preferred);
    }
  }
  log.info(`Server running at http://localhost:${port}`);
  return port;
}

let stopping = null;

// Stop every active session (so the DB marks them ended), disconnect all clients and close the
// HTTP server. Safe to call more than once.
export function stopServer() {
  stopping ??= (async () => {
    clearInterval(cleanupInterval);
    await Promise.all([...activeSessions.keys()].map((id) =>
      stopSession(id).catch((err) => log.error("Stopping session on shutdown failed", err))));
    // io.close() disconnects every socket and closes the HTTP server; drop idle keep-alive
    // connections too, otherwise close() waits for them
    await new Promise((resolve) => {
      io.close(() => resolve());
      server.closeAllConnections?.();
    });
  })();
  return stopping;
}


// Auto-start when running directly (not via Electron). Electron's main.js installs its own
// process-level handlers and starts the server itself.
if (!process.env.ELECTRON) {
  // Keep serving after an unexpected error: log it and tell connected clients what happened
  const reportFatal = (label) => (err) => {
    log.error(label, err);
    io.emit("error", { message: `${label}: ${err?.message || err}` });
  };
  process.on("uncaughtException", reportFatal("Unexpected server error"));
  process.on("unhandledRejection", reportFatal("Unhandled server error"));

  // Graceful shutdown (Ctrl+C / kill): end sessions, disconnect clients, then actually exit
  const shutdown = (signal) => {
    log.info(`Received ${signal}, shutting down`);
    setTimeout(() => process.exit(0), 3000).unref(); // don't hang on a stuck session
    stopServer().finally(() => process.exit(0));
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  startServer().catch((err) => {
    // Without a port the server can't do anything — explain why and exit cleanly (no stack trace)
    log.error("Server failed to start", err);
    console.error(`\n✖ Node Trans could not start: ${err.message}\n`);
    process.exit(1);
  });
}
