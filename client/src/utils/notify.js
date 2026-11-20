import { en, vi } from "../i18n/locales.js";

const locales = { en, vi };

/** "1:05:09" / "4:59" — same format as the toolbar timer */
export function formatDuration(ms) {
  const totalSec = Math.floor(Math.max(0, ms) / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

function translate(key, params) {
  let lang = "en";
  try { lang = localStorage.getItem("node-trans-lang") || "en"; } catch { /* storage blocked */ }
  let str = locales[lang]?.[key] || en[key] || key;
  for (const [k, v] of Object.entries(params || {})) str = str.replace(`{${k}}`, v);
  return str;
}

/** Ask once for notification permission (web only — Electron grants it). */
export function requestNotificationPermission() {
  try {
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  } catch {
    // Notifications unsupported — the in-app banner/toast still shows
  }
}

/** System notification, only while the app is not in front (in front, the in-app UI is enough). */
export function notifyInBackground(key, params) {
  try {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    if (document.visibilityState === "visible" && document.hasFocus()) return;
    new Notification("Node Trans", { body: translate(key, params), silent: false });
  } catch {
    // Notifications unsupported or blocked — nothing else to do
  }
}
