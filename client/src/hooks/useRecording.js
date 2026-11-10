import { useState, useEffect, useCallback, useRef, useSyncExternalStore } from "react";
import { useSocketActions, useSession, useUI } from "../context/SocketContext";
import { fetchSettings } from "../utils/api";
import { CONTEXT_PRESETS } from "../utils/constants";
import { reportError } from "../utils/errors";

/*
 * Recording controls shared by the toolbar (start/stop/pause) and the session setup bar
 * (context picker). The context draft lives in a tiny module store so the toolbar's Start
 * button always uses whatever the setup bar currently shows, even when the bar is hidden.
 */
let draft = { preset: "none", custom: "" };
let defaults = { preset: "none", custom: "" };
const listeners = new Set();

function setDraft(patch) {
  draft = { ...draft, ...patch };
  listeners.forEach((l) => l());
}
function subscribe(l) {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** [{ preset, custom }, setPreset, setCustom] for the context picker */
export function useContextDraft() {
  const value = useSyncExternalStore(subscribe, () => draft);
  return [value, (preset) => setDraft({ preset }), (custom) => setDraft({ custom })];
}

function activeContext() {
  if (draft.preset === "custom") return draft.custom.trim() || null;
  const preset = CONTEXT_PRESETS.find((p) => p.value === draft.preset);
  return preset && preset.text ? preset.text : null;
}

export function formatDuration(ms) {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/** Mount once (toolbar). Returns recording actions + elapsed time. */
export function useRecording() {
  const { socket, dispatch } = useSocketActions();
  const { isListening, isPaused, pendingAction, selectedSessionId, selectedSessionData } = useSession();
  const { listeningSince, pausedElapsed, reconnectCount } = useUI();
  const [elapsed, setElapsed] = useState(0);
  const defaultsLoaded = useRef(false);

  // Default context from settings — retried after a lost connection if the first load failed
  // (never re-applied once loaded, so it can't overwrite the user's current choice)
  useEffect(() => {
    if (defaultsLoaded.current) return;
    fetchSettings()
      .then((s) => {
        defaultsLoaded.current = true;
        defaults = { preset: s.defaultContext || "none", custom: s.defaultCustomContext || "" };
        if (!selectedSessionId) setDraft(defaults);
      })
      .catch((err) => reportError(dispatch, err, "errLoadSettings"));
  }, [reconnectCount]);

  // Follow the selected session's context (or fall back to the default)
  useEffect(() => {
    const selected = selectedSessionData;
    if (selected && selected.context) {
      const preset = CONTEXT_PRESETS.find((p) => p.value !== "custom" && p.text === selected.context);
      if (preset) setDraft({ preset: preset.value, custom: "" });
      else setDraft({ preset: "custom", custom: selected.context });
    } else {
      setDraft(defaults);
    }
  }, [selectedSessionId, selectedSessionData]);

  useEffect(() => {
    if (!isListening) {
      setElapsed(0);
      return;
    }
    const calc = () => (listeningSince ? Date.now() - listeningSince : 0) + pausedElapsed;
    setElapsed(calc());
    if (!listeningSince) return; // paused — no ticking
    const id = setInterval(() => setElapsed(calc()), 1000);
    return () => clearInterval(id);
  }, [isListening, listeningSince, pausedElapsed]);

  const emit = useCallback((event, payload = {}) => {
    if (pendingAction) return;
    dispatch({ type: "SET_PENDING" });
    socket.emit(event, payload);
  }, [pendingAction, dispatch, socket]);

  const toggle = useCallback(() => {
    if (pendingAction) return;
    dispatch({ type: "SET_PENDING" });
    const context = activeContext();
    if (isListening) {
      socket.emit("stop-listening");
    } else if (selectedSessionId) {
      dispatch({ type: "SET_CONTEXT", payload: context });
      socket.emit("start-listening", { sessionId: selectedSessionId, context });
    } else {
      dispatch({ type: "SET_CONTEXT", payload: context });
      socket.emit("start-listening", { context });
    }
  }, [pendingAction, isListening, selectedSessionId, dispatch, socket]);

  const pauseResume = useCallback(() => {
    if (!isListening) return;
    emit(isPaused ? "resume-listening" : "pause-listening");
  }, [isListening, isPaused, emit]);

  const newMeeting = useCallback(() => {
    if (pendingAction) return;
    dispatch({ type: "SET_PENDING" });
    const context = activeContext();
    dispatch({ type: "SET_CONTEXT", payload: context });
    socket.emit("stop-listening");
    dispatch({ type: "CLEAR_TRANSCRIPT" });
    setTimeout(() => socket.emit("start-listening", { context }), 200);
  }, [pendingAction, dispatch, socket]);

  return { elapsed, toggle, pauseResume, newMeeting };
}
