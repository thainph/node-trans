import fs from "fs";
import path from "path";
import os from "os";

const CONFIG_DIR = process.env.ELECTRON_USER_DATA
  ? path.join(process.env.ELECTRON_USER_DATA, "data")
  : path.join(os.homedir(), ".node-trans");
const SETTINGS_FILE = path.join(CONFIG_DIR, "settings.json");

const DEFAULTS = {
  audioSource: "mic",
  micDeviceIndex: null,
  systemDeviceIndex: null,
  targetLanguage: "vi",
  micTargetLanguage: null,
  systemTargetLanguage: null,
  micWhisperLanguage: "auto",
  systemWhisperLanguage: "auto",
  languageHints: ["en"],
  port: 3333,
  sonioxApiKey: null,
  enableDiarization: false,
  hfToken: null,
  transcriptionEngine: "soniox",
  whisperModel: "base",
  whisperLanguage: "auto",
  localTranslationEngine: "none",
  ollamaBaseUrl: "http://localhost:11434",
  ollamaModel: "llama3.2",
  defaultContext: "none",
  defaultCustomContext: "",
  // Per-recording duration limit (recording time, pauses excluded)
  sessionLimitEnabled: false,
  sessionLimitMinutes: 60,
  sessionLimitAction: "warn", // "warn" | "stop"
  sessionLimitWarnMinutes: 5,
  overlay: {
    opacity: 0.8,
    scale: 1,
    textAlign: "left",
    bgColor: "dark",
    maxLines: 5,
    fontFamily: "system-ui, sans-serif",
    finalContent: "both",
    partialContent: "both",
    translatedFontSize: 1,
    translatedColor: "",
    originalFontSize: 0.8,
    originalColor: "",
  },
};

export function loadSettings() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const data = JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf-8"));
      return { ...DEFAULTS, ...data, overlay: { ...DEFAULTS.overlay, ...(data.overlay || {}) } };
    }
  } catch {
    // Corrupt file — fall back to defaults
  }
  return { ...DEFAULTS };
}

export function saveSettings(settings) {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
  const existing = loadSettings();
  const merged = { ...existing, ...settings };
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(merged, null, 2));
  return merged;
}
