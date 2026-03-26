import { Router } from "express";
import { loadSettings, saveSettings } from "../storage/settings.js";

// Lazy-loaded modules
let _devices, _history, _export;
async function lazyDevices() {
  if (!_devices) _devices = await import("../audio/devices.js");
  return _devices;
}
async function lazyHistory() {
  if (!_history) _history = await import("../storage/history.js");
  return _history;
}
async function lazyExport() {
  if (!_export) _export = await import("../storage/export.js");
  return _export;
}

const router = Router();

// Devices
router.get("/devices", async (req, res) => {
  try {
    const { listAllDevices } = await lazyDevices();
    const devices = await listAllDevices();
    res.json(devices);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Settings
router.get("/settings", (req, res) => {
  const settings = loadSettings();
  // Mask API key — only indicate whether it's set
  if (settings.sonioxApiKey) {
    settings.sonioxApiKey = "••••" + settings.sonioxApiKey.slice(-4);
  }
  res.json(settings);
});

router.put("/settings", (req, res) => {
  const body = req.body;
  // Don't overwrite API key with masked value
  if (body.sonioxApiKey && body.sonioxApiKey.startsWith("••••")) {
    delete body.sonioxApiKey;
  }
  const updated = saveSettings(body);
  // Mask API key in response
  if (updated.sonioxApiKey) {
    updated.sonioxApiKey = "••••" + updated.sonioxApiKey.slice(-4);
  }
  res.json(updated);
});

// Sessions
router.get("/sessions", async (req, res) => {
  const { getSessions } = await lazyHistory();
  const limit = parseInt(req.query.limit) || 50;
  const offset = parseInt(req.query.offset) || 0;
  res.json(getSessions(limit, offset));
});

router.get("/sessions/:id", async (req, res) => {
  const { getSession, getUtterances, getSpeakerAliases } = await lazyHistory();
  const session = getSession(req.params.id);
  if (!session) return res.status(404).json({ error: "Session not found" });

  const utterances = getUtterances(req.params.id);
  const speakerAliases = getSpeakerAliases(req.params.id);
  const aliasMap = Object.fromEntries(speakerAliases.map((a) => [a.speaker, a.alias]));
  res.json({ ...session, utterances, speakerAliases: aliasMap });
});

router.patch("/sessions/:id", async (req, res) => {
  const { renameSession } = await lazyHistory();
  const { title } = req.body;
  if (title == null) return res.status(400).json({ error: "title is required" });
  renameSession(req.params.id, title);
  res.json({ ok: true });
});

router.put("/sessions/:id/speakers/:speaker", async (req, res) => {
  const { setSpeakerAlias } = await lazyHistory();
  const { alias } = req.body;
  if (!alias) return res.status(400).json({ error: "alias is required" });
  setSpeakerAlias(req.params.id, req.params.speaker, alias);
  res.json({ ok: true });
});

router.delete("/sessions/:id", async (req, res) => {
  const { deleteSession } = await lazyHistory();
  deleteSession(req.params.id);
  res.json({ ok: true });
});

// Export
router.get("/sessions/:id/export", async (req, res) => {
  const { exportSessionToMarkdown } = await lazyExport();
  const result = exportSessionToMarkdown(req.params.id);
  if (!result) return res.status(404).json({ error: "Session not found" });

  res.setHeader("Content-Type", "text/markdown; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="session-${req.params.id}.md"`);
  res.send(result.markdown);
});

export default router;
