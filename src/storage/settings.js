import fs from "fs";
import path from "path";
import os from "os";

const CONFIG_DIR = path.join(os.homedir(), ".node-trans");
const SETTINGS_FILE = path.join(CONFIG_DIR, "settings.json");

const DEFAULTS = {
  audioSource: "mic",
  micDeviceIndex: null,
  systemDeviceIndex: null,
  targetLanguage: "vi",
  micTargetLanguage: null,
  systemTargetLanguage: null,
  languageHints: ["en"],
  port: 3000,
};

export function loadSettings() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const data = JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf-8"));
      return { ...DEFAULTS, ...data };
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
  const merged = { ...DEFAULTS, ...settings };
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(merged, null, 2));
  return merged;
}
