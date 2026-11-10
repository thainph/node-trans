/*
 * Shared error reporting for the renderer: every failure ends up as a readable error toast.
 *
 *   try { await deleteSession(id); } catch (err) { reportError(dispatch, err, "errDeleteSession"); }
 *
 * The toast stores the i18n key + raw error so it re-renders in the current language
 * (see Toast.jsx → formatToast).
 */

const DEDUPE_MS = 5000;
const recent = new Map(); // text → last shown timestamp

/** True when the same text was already shown in the last few seconds (stops toast loops) */
export function isDuplicate(text) {
  const now = Date.now();
  for (const [k, ts] of recent) if (now - ts > DEDUPE_MS) recent.delete(k);
  if (recent.has(text)) return true;
  recent.set(text, now);
  return false;
}

/** Plain-English reason for any thrown value; never throws itself */
export function errorMessage(err) {
  try {
    if (err == null) return "Unknown error";
    if (typeof err === "string") return err || "Unknown error";
    if (err.message) return String(err.message);
    const s = String(err);
    return s === "[object Object]" ? JSON.stringify(err) : s;
  } catch {
    return "Unknown error";
  }
}

/** Reason in the UI language: network failures from utils/api.js get a translated message */
export function errorReason(t, err) {
  if (err?.code === "NETWORK") return t("errServerUnreachable", { detail: err.detail || "" }).replace(/\s*\(\)$/, "");
  return errorMessage(err);
}

/**
 * Show an error toast. `labelKey` is an i18n key with a `{reason}` placeholder,
 * e.g. "Couldn't delete session: {reason}". Without a label, the reason alone is shown.
 */
export function reportError(dispatch, err, labelKey) {
  const reason = errorMessage(err);
  console.error(`[${labelKey || "error"}]`, err);
  // Server unreachable: every request fails the same way — show it once, not once per request
  if (err?.code === "NETWORK") {
    if (isDuplicate("NETWORK")) return;
    labelKey = null;
  } else if (isDuplicate(`${labelKey}|${reason}`)) return;
  dispatch({
    type: "TOAST",
    payload: {
      type: "error",
      key: labelKey || null,
      error: { message: reason, code: err?.code, detail: err?.detail },
    },
  });
}
