import { useEffect, useRef } from "react";

/*
 * App commands, triggered from the native menu bar (Electron) or keyboard shortcuts (web).
 *
 *   useCommand("toggle-recording", () => …)
 *
 * A handler may return false to say it did nothing (the web shortcut then falls through to the
 * browser, e.g. Cmd+F find-in-page). Commands are ignored while a sheet (modal) is open.
 *
 * Command ids: settings, new-session, toggle-recording, pause-resume, toggle-overlay,
 * export, rename, delete, find, toggle-sidebar.
 */
const handlers = new Map(); // id -> Set<ref>
const isMac = /Mac/.test(navigator.platform);

export function runCommand(id) {
  if (document.querySelector(".sheet-backdrop")) return false;
  const set = handlers.get(id);
  if (!set || set.size === 0) return false;
  // Latest registration wins so a focused component can take over a shortcut
  return [...set].at(-1).current?.() !== false;
}

// Keep in sync with the menu accelerators in electron/main.js.
// `ctrl` = the Control key on macOS (in addition to ⌘).
const SHORTCUTS = [
  { id: "settings", key: ",", mod: true },
  { id: "new-session", key: "n", mod: true },
  { id: "toggle-recording", key: "r", mod: true },
  { id: "pause-resume", key: "p", mod: true, shift: true },
  { id: "toggle-overlay", key: "o", mod: true, shift: true },
  { id: "export", key: "e", mod: true },
  { id: "find", key: "f", mod: true },
  isMac
    ? { id: "toggle-sidebar", key: "s", mod: true, ctrl: true }
    : { id: "toggle-sidebar", key: "b", mod: true },
];

let installed = false;
function install() {
  if (installed) return;
  installed = true;

  if (window.electronAPI?.onMenuAction) {
    window.electronAPI.onMenuAction((id) => runCommand(id));
    return;
  }

  document.addEventListener("keydown", (e) => {
    const mod = isMac ? e.metaKey : e.ctrlKey;
    const hit = SHORTCUTS.find((s) =>
      s.key === e.key.toLowerCase() &&
      !!s.mod === mod &&
      !!s.shift === e.shiftKey &&
      (!isMac || !!s.ctrl === e.ctrlKey)
    );
    if (hit && runCommand(hit.id)) e.preventDefault();
  });
}

export function useCommand(id, handler) {
  const ref = useRef(handler);
  ref.current = handler;

  useEffect(() => {
    install();
    if (!handlers.has(id)) handlers.set(id, new Set());
    const set = handlers.get(id);
    set.add(ref);
    return () => set.delete(ref);
  }, [id]);
}

// Shortcut label for tooltips, e.g. shortcutLabel("toggle-recording") -> "⌘R" / "Ctrl+R"
export function shortcutLabel(id) {
  const s = SHORTCUTS.find((x) => x.id === id);
  if (!s) return "";
  const key = s.key === "," ? "," : s.key.toUpperCase();
  if (isMac) return `${s.ctrl ? "⌃" : ""}${s.shift ? "⇧" : ""}⌘${key}`;
  return `Ctrl+${s.shift ? "Shift+" : ""}${key}`;
}
