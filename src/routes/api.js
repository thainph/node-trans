import { Router } from "express";
import { existsSync, unlinkSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";
import { loadSettings, saveSettings } from "../storage/settings.js";
import { createLogger } from "../logger.js";
import { ErrorCodes, apiError } from "../errors.js";
const log = createLogger("api");

const __dirname = fileURLToPath(new URL(".", import.meta.url));

// Lazy-loaded modules — cache the Promise itself so concurrent callers share one load
let _devicesP, _historyP, _exportP;
function lazyDevices() {
  if (!_devicesP) _devicesP = import("../audio/devices.js");
  return _devicesP;
}
function lazyHistory() {
  if (!_historyP) _historyP = import("../storage/history.js");
  return _historyP;
}
function lazyExport() {
  if (!_exportP) _exportP = import("../storage/export.js");
  return _exportP;
}

// ── Status check helpers (each runs independently) ──────────────────────────

async function checkWhisperStatus(modelName) {
  try {
    const { getVenvPython } = await import("../local/python-utils.js");
    const { isModelDownloaded, checkSystemPython } = await import("../local/whisper-setup.js");
    let whisperPyReady = false;
    try { getVenvPython(); whisperPyReady = true; } catch {}
    const systemPython = await checkSystemPython();
    return {
      whisperPyReady,
      whisperModelDownloaded: whisperPyReady ? isModelDownloaded(modelName) : false,
      pythonAvailable: systemPython.found,
      pythonVersion: systemPython.version || null,
    };
  } catch {
    return { whisperPyReady: false, whisperModelDownloaded: false, pythonAvailable: false, pythonVersion: null };
  }
}

async function checkOllamaStatus(baseUrl, targetModel) {
  let ollamaAvailable = false;
  let ollamaModelReady = false;
  try {
    const r = await fetch(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(2000) });
    if (r.ok) {
      ollamaAvailable = true;
      const data = await r.json();
      const pulled = (data.models || []).map((m) => m.name.toLowerCase());
      const t = (targetModel || "").toLowerCase();
      ollamaModelReady = pulled.some((n) => n === t || n.startsWith(t + ":") || n === t + ":latest");
    }
  } catch {}
  return { ollamaAvailable, ollamaModelReady, platform: process.platform };
}

async function checkLibreTranslateStatus(url) {
  if (!url) return { libreTranslateAvailable: false };
  try {
    const r = await fetch(`${url}/languages`, { signal: AbortSignal.timeout(2000) });
    return { libreTranslateAvailable: r.ok };
  } catch {
    return { libreTranslateAvailable: false };
  }
}

async function checkDiarizeStatus() {
  let diarizePyReady = false;
  try {
    const { getVenvPython } = await import("../local/python-utils.js");
    const pythonBin = getVenvPython();
    const verifyScript = [
      "import torchaudio",
      "hasattr(torchaudio,'set_audio_backend') or setattr(torchaudio,'set_audio_backend',lambda *a,**kw:None)",
      "hasattr(torchaudio,'get_audio_backend') or setattr(torchaudio,'get_audio_backend',lambda:'soundfile')",
      "hasattr(torchaudio,'list_audio_backends') or setattr(torchaudio,'list_audio_backends',lambda:['soundfile'])",
      "import numpy as np",
      "hasattr(np,'NaN') or setattr(np,'NaN',np.nan)",
      "hasattr(np,'NAN') or setattr(np,'NAN',np.nan)",
      "import torch, faster_whisper, pyannote.audio",
    ].join("; ");
    await new Promise((resolve) => {
      const proc = spawn(pythonBin, ["-c", verifyScript], { stdio: "ignore" });
      const timer = setTimeout(() => { proc.kill(); resolve(); }, 15000);
      proc.on("close", (code) => { clearTimeout(timer); diarizePyReady = code === 0; resolve(); });
      proc.on("error", () => { clearTimeout(timer); resolve(); });
    });
  } catch {}
  return { diarizePyReady };
}

// ─────────────────────────────────────────────────────────────────────────────

const router = Router();

// Disable caching for all API responses
router.use((req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

// Validate :id param is a positive integer
router.param("id", (req, res, next, val) => {
  const id = Number(val);
  if (!Number.isInteger(id) || id <= 0) {
    return apiError(res, 400, ErrorCodes.INVALID_INPUT, "Invalid session ID");
  }
  req.params.id = id;
  next();
});

// Devices
router.get("/devices", async (req, res) => {
  try {
    const { listAllDevices } = await lazyDevices();
    const devices = await listAllDevices();
    res.json(devices);
  } catch (err) {
    apiError(res, 500, ErrorCodes.INTERNAL_ERROR, "Failed to list devices");
  }
});

// Settings
router.get("/settings", (req, res) => {
  const settings = loadSettings();
  if (settings.sonioxApiKey) {
    settings.sonioxApiKey = "••••" + settings.sonioxApiKey.slice(-4);
  }
  if (settings.hfToken) {
    settings.hfToken = "••••" + settings.hfToken.slice(-4);
  }
  res.json(settings);
});

router.put("/settings", (req, res) => {
  const body = req.body;
  const existing = loadSettings();
  if (!body.sonioxApiKey || body.sonioxApiKey.startsWith("••••")) {
    body.sonioxApiKey = existing.sonioxApiKey;
  }
  if (!body.hfToken || body.hfToken.startsWith("••••")) {
    body.hfToken = existing.hfToken;
  }
  const updated = saveSettings(body);
  if (updated.sonioxApiKey) {
    updated.sonioxApiKey = "••••" + updated.sonioxApiKey.slice(-4);
  }
  if (updated.hfToken) {
    updated.hfToken = "••••" + updated.hfToken.slice(-4);
  }
  res.json(updated);
});

// Overlay settings
router.get("/settings/overlay", (req, res) => {
  const settings = loadSettings();
  res.json(settings.overlay || {});
});

router.put("/settings/overlay", (req, res) => {
  const current = loadSettings();
  const overlay = { ...(current.overlay || {}), ...req.body };
  const updated = saveSettings({ ...current, overlay });
  res.json(updated.overlay);
});

// Focused status endpoints — each checks only one concern

router.get("/local/status/whisper", async (req, res) => {
  const settings = loadSettings();
  const model = req.query.model || settings.whisperModel || "base";
  res.json(await checkWhisperStatus(model));
});

router.get("/local/status/ollama", async (req, res) => {
  const settings = loadSettings();
  const baseUrl = settings.ollamaBaseUrl || "http://localhost:11434";
  const model = req.query.model || settings.ollamaModel || "";
  res.json(await checkOllamaStatus(baseUrl, model));
});

router.get("/local/status/libretranslate", async (req, res) => {
  const settings = loadSettings();
  res.json(await checkLibreTranslateStatus(settings.libreTranslateUrl));
});

router.get("/local/status/diarize", async (req, res) => {
  res.json(await checkDiarizeStatus());
});

// Whisper model removal
router.delete("/local/whisper-model", async (req, res) => {
  const settings = loadSettings();
  const model = req.query.model || settings.whisperModel || "base";
  const { default: os } = await import("os");
  const modelPath = join(os.homedir(), ".cache", "whisper", `${model}.pt`);
  if (!existsSync(modelPath)) return apiError(res, 404, ErrorCodes.NOT_FOUND, "Model file not found");
  try {
    unlinkSync(modelPath);
    res.json({ ok: true });
  } catch (err) {
    apiError(res, 500, ErrorCodes.INTERNAL_ERROR, "Failed to delete model");
  }
});

// Whisper setup — SSE endpoint for streaming install + model download progress
router.get("/local/whisper-setup", async (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const send = (data) => {
    try { res.write(`data: ${JSON.stringify(data)}\n\n`); } catch {}
  };

  const modelName = req.query.model || "base";

  try {
    const { runWhisperSetup } = await import("../local/whisper-setup.js");
    const { createSetupLogger } = await import("../local/setup-log.js");
    const logger = createSetupLogger("whisper-setup", (event) => send(event));
    try {
      await runWhisperSetup(modelName, logger.onEvent);
      logger.close();
      send({ done: true });
    } catch (err) {
      logger.close(err.message);
      send({ error: err.message, logFile: logger.logPath });
    }
  } catch (err) {
    send({ error: err.message });
  }
  res.end();
});

// Diarize setup — SSE endpoint for streaming install logs
router.get("/local/diarize-setup", async (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const send = (data) => {
    try { res.write(`data: ${JSON.stringify(data)}\n\n`); } catch {}
  };

  try {
    const { runDiarizeSetup } = await import("../local/diarize-setup.js");
    const { createSetupLogger } = await import("../local/setup-log.js");
    const logger = createSetupLogger("diarize-setup", (event) => send(event));
    try {
      await runDiarizeSetup((line) => logger.onEvent({ line }));
      logger.close();
      send({ done: true });
    } catch (err) {
      logger.close(err.message);
      send({ error: err.message, logFile: logger.logPath });
    }
  } catch (err) {
    send({ error: err.message });
  }
  res.end();
});

// Sessions
router.get("/sessions", async (req, res) => {
  const { getSessions } = await lazyHistory();
  const limit = parseInt(req.query.limit) || 50;
  const offset = parseInt(req.query.offset) || 0;
  res.json(getSessions(limit, offset));
});

// Export
function sendExport(res, result) {
  // ASCII fallback for old clients, RFC 5987 form for titles with diacritics
  const asciiName = result.filename.normalize("NFD").replace(/[^\x20-\x7e]/g, "").replace(/"/g, "");
  res.setHeader("Content-Type", result.mime);
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(result.filename)}`
  );
  res.send(result.body);
}

// Registered before /sessions/:id so "export" is not taken as an id
router.get("/sessions/export", async (req, res) => {
  const ids = String(req.query.ids || "").split(",").map(Number).filter((n) => Number.isInteger(n) && n > 0);
  if (ids.length === 0) return apiError(res, 400, ErrorCodes.INVALID_INPUT, "ids is required");
  try {
    const { exportSessions, normalizeExportOptions } = await lazyExport();
    const result = await exportSessions(ids, normalizeExportOptions(req.query));
    if (!result) return apiError(res, 404, ErrorCodes.NOT_FOUND, "Session not found");
    sendExport(res, result);
  } catch (err) {
    log.error("Export sessions error", err);
    apiError(res, 500, ErrorCodes.INTERNAL_ERROR, "Failed to export sessions");
  }
});

router.get("/sessions/:id/export", async (req, res) => {
  try {
    const { exportSession, normalizeExportOptions } = await lazyExport();
    const result = await exportSession(req.params.id, normalizeExportOptions(req.query));
    if (!result) return apiError(res, 404, ErrorCodes.NOT_FOUND, "Session not found");
    sendExport(res, result);
  } catch (err) {
    log.error("Export session error", err);
    apiError(res, 500, ErrorCodes.INTERNAL_ERROR, "Failed to export session");
  }
});

router.get("/sessions/:id", async (req, res) => {
  const { getSession, getUtterances, getSpeakerAliases } = await lazyHistory();
  const session = getSession(req.params.id);
  if (!session) return apiError(res, 404, ErrorCodes.NOT_FOUND, "Session not found");

  const utterances = getUtterances(req.params.id);
  const speakerAliases = getSpeakerAliases(req.params.id);
  const aliasMap = Object.fromEntries(speakerAliases.map((a) => [a.speaker, a.alias]));
  res.json({ ...session, utterances, speakerAliases: aliasMap });
});

router.patch("/sessions/:id", async (req, res) => {
  const { renameSession } = await lazyHistory();
  const { title } = req.body;
  if (title == null) return apiError(res, 400, ErrorCodes.INVALID_INPUT, "title is required");
  renameSession(req.params.id, title);
  res.json({ ok: true });
});

router.patch("/sessions/:id/context", async (req, res) => {
  const { updateSessionContext } = await lazyHistory();
  const { context } = req.body;
  updateSessionContext(req.params.id, context ?? null);
  res.json({ ok: true });
});

router.put("/sessions/:id/speakers/:speaker", async (req, res) => {
  const { setSpeakerAlias } = await lazyHistory();
  const { alias } = req.body;
  if (!alias) return apiError(res, 400, ErrorCodes.INVALID_INPUT, "alias is required");
  setSpeakerAlias(req.params.id, req.params.speaker, alias);
  res.json({ ok: true });
});

router.delete("/sessions/:id", async (req, res) => {
  try {
    const { deleteSession } = await lazyHistory();
    deleteSession(Number(req.params.id));
    res.json({ ok: true });
  } catch (err) {
    log.error("Delete session error", err);
    apiError(res, 500, ErrorCodes.INTERNAL_ERROR, "Failed to delete session");
  }
});

export default router;
