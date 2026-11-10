const API = "/api";
const NO_CACHE = { cache: "no-store" };

/**
 * fetch() wrapper that throws a readable Error on failure:
 * - network failure → `err.code = "NETWORK"` ("Cannot reach the local server (…)")
 * - non-2xx → the server's `{ error: { message } }` / `{ error: "…" }`, else "<METHOD> <path> failed: <status>"
 */
export async function request(path, { method = "GET", body, ...init } = {}) {
  const url = path.startsWith("/") ? path : `${API}/${path}`;
  const opts = { method, ...(method === "GET" ? NO_CACHE : {}), ...init };
  if (body !== undefined) {
    opts.headers = { "Content-Type": "application/json", ...opts.headers };
    opts.body = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(url, opts);
  } catch (err) {
    const detail = err?.message || String(err);
    const e = new Error(`Cannot reach the local server (${detail})`);
    e.code = "NETWORK";
    e.detail = detail;
    throw e;
  }

  if (!res.ok) {
    let message = null;
    let code = "HTTP";
    try {
      const data = await res.json();
      if (typeof data?.error === "string") message = data.error;
      else if (data?.error?.message) {
        message = data.error.message;
        if (data.error.code) code = data.error.code;
      }
    } catch {
      // Body isn't JSON — fall back to the status line
    }
    // A gateway error without our JSON body means the dev proxy couldn't reach the server
    if (!message && res.status >= 502 && res.status <= 504) {
      const e = new Error(`Cannot reach the local server (${res.status} ${res.statusText})`);
      e.code = "NETWORK";
      e.detail = `${res.status} ${res.statusText}`;
      e.status = res.status;
      throw e;
    }
    const e = new Error(message || `${method} ${url} failed: ${res.status} ${res.statusText}`.trim());
    e.code = code;
    e.status = res.status;
    throw e;
  }
  return res;
}

/** request() + parsed JSON body (empty body → null) */
export async function requestJson(path, options) {
  const res = await request(path, options);
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${options?.method || "GET"} ${path}: invalid JSON response`);
  }
}

export function fetchSessions(limit = 50, offset = 0) {
  return requestJson(`${API}/sessions?limit=${limit}&offset=${offset}`);
}

export function fetchSession(id) {
  return requestJson(`${API}/sessions/${id}`);
}

export function deleteSession(id) {
  return requestJson(`${API}/sessions/${id}`, { method: "DELETE" });
}

// These three resolve to the raw Response, as before
export function updateSessionContext(id, context) {
  return request(`${API}/sessions/${id}/context`, { method: "PATCH", body: { context } });
}

export function renameSession(id, title) {
  return request(`${API}/sessions/${id}`, { method: "PATCH", body: { title } });
}

export function setSpeakerAlias(sessionId, speaker, alias) {
  return request(`${API}/sessions/${sessionId}/speakers/${encodeURIComponent(speaker)}`, { method: "PUT", body: { alias } });
}

export function fetchSettings() {
  return requestJson(`${API}/settings`);
}

export function saveSettings(settings) {
  return requestJson(`${API}/settings`, { method: "PUT", body: settings });
}

export function fetchOverlaySettings() {
  return requestJson(`${API}/settings/overlay`);
}

export function saveOverlaySettings(settings) {
  return requestJson(`${API}/settings/overlay`, { method: "PUT", body: settings });
}

export function fetchDevices() {
  return requestJson(`${API}/devices`);
}

/** Local engine status: kind ∈ whisper | ollama | libretranslate | diarize */
export function fetchLocalStatus(kind, model) {
  const qs = model !== undefined ? `?model=${encodeURIComponent(model)}` : "";
  return requestJson(`${API}/local/status/${kind}${qs}`);
}

export function removeWhisperModel(model) {
  return requestJson(`${API}/local/whisper-model?model=${encodeURIComponent(model)}`, { method: "DELETE" });
}

export function getExportUrl(sessionIds, options = {}) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(options)) {
    params.set(k, typeof v === "boolean" ? (v ? "1" : "0") : v);
  }
  const path = sessionIds.length === 1 ? `sessions/${sessionIds[0]}/export` : "sessions/export";
  if (sessionIds.length > 1) params.set("ids", sessionIds.join(","));
  const qs = params.toString();
  return `${API}/${path}${qs ? `?${qs}` : ""}`;
}

// The server sends Content-Disposition, so this downloads in place: no blank tab in the browser,
// and Electron shows its save dialog (see will-download in electron/main.js)
export function downloadFile(url) {
  const a = document.createElement("a");
  a.href = url;
  a.download = "";
  document.body.appendChild(a);
  a.click();
  a.remove();
}
