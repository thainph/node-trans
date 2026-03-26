import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { fileURLToPath } from "url";
import path from "path";

import apiRoutes from "./routes/api.js";
import { loadSettings } from "./storage/settings.js";
import { createSession as createSonioxSession } from "./soniox/session.js";
import { startCapture } from "./audio/capture.js";
import { listInputDevices } from "./audio/devices.js";
import * as history from "./storage/history.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const server = createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static(path.join(__dirname, "../dist")));
app.use("/api", apiRoutes);

// Active sessions per socket
const activeSessions = new Map();

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  socket.on("start-listening", async (opts) => {
    // Clean up any existing session
    await stopSession(socket.id);

    try {
      const settings = loadSettings();
      const resumeSessionId = opts?.sessionId;
      let audioSource, micTargetLanguage, systemTargetLanguage;

      if (resumeSessionId) {
        // Resume existing session
        const existing = history.getSession(resumeSessionId);
        if (!existing || !existing.ended_at) {
          socket.emit("error", { message: "Session not found or still active" });
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
      } else {
        audioSource = settings.audioSource;
        const targetLanguage = settings.targetLanguage;
        micTargetLanguage = settings.micTargetLanguage ?? targetLanguage;
        systemTargetLanguage = settings.systemTargetLanguage ?? targetLanguage;
      }

      const languageHints = settings.languageHints || ["en"];

      // Resolve devices
      const devices = await listInputDevices();
      const isWin = process.platform === "win32";
      const micIndex = settings.micDeviceIndex ?? 0;
      const micDevice = devices.find((d) => d.index === micIndex);

      // On Windows, dshow needs device name; on macOS, avfoundation uses index
      const micCaptureDev = isWin ? micDevice?.name : micIndex;

      // System device: use manual setting or auto-detect virtual loopback input device
      let systemCaptureDev = null;
      if (audioSource === "system" || audioSource === "both") {
        const systemIndex = settings.systemDeviceIndex;
        if (systemIndex != null) {
          // Manual selection from settings
          const systemDevice = devices.find((d) => d.index === systemIndex);
          if (systemDevice) {
            systemCaptureDev = isWin ? systemDevice.name : systemDevice.index;
          } else {
            socket.emit("error", { message: `System audio device index ${systemIndex} not found` });
          }
        } else {
          // Auto-detect: macOS: BlackHole, Windows: VB-CABLE / Stereo Mix / CABLE Output
          const loopbackPattern = isWin
            ? /cable|stereo mix|virtual|vb-audio/i
            : /blackhole/i;
          const loopback = devices.find((d) => loopbackPattern.test(d.name));
          if (loopback) {
            systemCaptureDev = isWin ? loopback.name : loopback.index;
          } else {
            const hint = isWin
              ? "System audio device not found. Select a device in Settings, or install VB-CABLE."
              : "BlackHole chưa được cài đặt. Cần BlackHole để capture system audio.";
            socket.emit("error", { message: hint });
          }
        }
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
        dbSessionId = history.createSession(audioSource, historyTargetLang, deviceName);
      }

      const state = {
        dbSessionId,
        audioSource,
        paused: false,
        captures: [],
        sonioxSessions: [],
      };

      const sources = audioSource === "both"
        ? ["mic", "system"]
        : [audioSource];

      for (const source of sources) {
        const captureDev = source === "mic" ? micCaptureDev : systemCaptureDev;
        if (captureDev == null) {
          socket.emit("error", { message: `No device configured for ${source}` });
          continue;
        }

        // Start audio capture
        const capture = startCapture(captureDev);
        capture.onError((err) => {
          socket.emit("error", { message: `Audio capture error (${source}): ${err.message}` });
        });

        // Start Soniox session with per-source target language
        const sourceTargetLang = source === "mic" ? micTargetLanguage : systemTargetLanguage;
        const soniox = createSonioxSession({ targetLanguage: sourceTargetLang, languageHints });

        soniox.onPartial((partial) => {
          socket.emit("partial-result", { source, ...partial });
        });

        soniox.onUtterance((utterance, isFinished) => {
          socket.emit("utterance", { source, ...utterance });

          // Save to DB
          if (utterance.originalText) {
            history.addUtterance(dbSessionId, {
              ...utterance,
              source,
            });
          }
        });

        soniox.onError((err) => {
          socket.emit("error", { message: `Soniox error: ${err.message}` });
        });

        await soniox.connect();
        await soniox.startStreaming();

        // Pipe audio chunks to Soniox
        capture.stream.on("data", (chunk) => {
          soniox.sendAudio(chunk);
        });

        capture.stream.on("end", () => {
          soniox.stop().catch(() => {});
        });

        state.captures.push(capture);
        state.sonioxSessions.push(soniox);
      }

      activeSessions.set(socket.id, state);
      socket.emit("status", { listening: true, sessionId: dbSessionId, audioSource });
      console.log(`Started listening: socket=${socket.id}, session=${dbSessionId}, source=${audioSource}`);
    } catch (err) {
      socket.emit("error", { message: `Failed to start: ${err.message}` });
      console.error("Start error:", err);
    }
  });

  socket.on("pause-listening", () => {
    const state = activeSessions.get(socket.id);
    if (!state || state.paused) return;

    for (const capture of state.captures) {
      capture.pause();
    }
    state.paused = true;
    socket.emit("status", { listening: true, paused: true, sessionId: state.dbSessionId, audioSource: state.audioSource });
    console.log(`Paused: socket=${socket.id}`);
  });

  socket.on("resume-listening", () => {
    const state = activeSessions.get(socket.id);
    if (!state || !state.paused) return;

    for (const capture of state.captures) {
      capture.resume();
    }
    state.paused = false;
    socket.emit("status", { listening: true, paused: false, sessionId: state.dbSessionId, audioSource: state.audioSource });
    console.log(`Resumed: socket=${socket.id}`);
  });

  socket.on("stop-listening", async () => {
    await stopSession(socket.id);
    socket.emit("status", { listening: false });
  });

  socket.on("disconnect", async () => {
    await stopSession(socket.id);
    console.log("Client disconnected:", socket.id);
  });
});

async function stopSession(socketId) {
  const state = activeSessions.get(socketId);
  if (!state) return;

  for (const capture of state.captures) {
    capture.stop();
  }

  for (const soniox of state.sonioxSessions) {
    try {
      await soniox.stop();
    } catch {
      // Ignore stop errors
    }
  }

  history.endSession(state.dbSessionId);
  activeSessions.delete(socketId);
}

// Start server
const settings = loadSettings();
const PORT = process.env.PORT || settings.port || 3000;

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
