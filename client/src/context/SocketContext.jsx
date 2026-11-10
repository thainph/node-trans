import { createContext, useContext, useReducer, useEffect, useMemo } from "react";
import { io } from "socket.io-client";
import { getSpeakerIndex } from "../utils/speakerColors";
import { fetchOverlaySettings } from "../utils/api";
import { reportError } from "../utils/errors";

const SocketActionsContext = createContext(null);
const SessionContext = createContext(null);
const TranscriptContext = createContext(null);
const UIContext = createContext(null);

const OVERLAY_DEFAULTS = {
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
};

function loadOverlaySettings() {
  try {
    const saved = localStorage.getItem("overlay-settings");
    if (saved) return { ...OVERLAY_DEFAULTS, ...JSON.parse(saved) };
  } catch {
    // Missing/corrupt local copy — the server copy is loaded on mount anyway
  }
  return { ...OVERLAY_DEFAULTS };
}

const initialState = {
  isListening: false,
  isPaused: false,
  currentSessionId: null,
  selectedSessionId: null,
  selectedSessionData: null,
  pendingAction: false,
  statusText: "connecting",
  statusKey: "connecting",
  statusClass: "",
  toasts: [],
  utterances: [],
  partialResults: {},
  speakerColorMap: new Map(),
  listeningSince: null,
  pausedElapsed: 0,
  sessionListVersion: 0,
  // Bumped when the connection comes back after an outage, so data loaded at startup is fetched again
  reconnectCount: 0,
  overlayVisible: false,
  overlaySettings: loadOverlaySettings(),
  activeContext: null,
  nextUtteranceId: 1,
  connectionLost: false,
};

function newToast(toast) {
  return { id: Date.now() + Math.random(), key: null, message: null, ...toast };
}

function reducer(state, action) {
  switch (action.type) {
    case "STATUS": {
      const d = action.payload;
      const isListening = d.listening;
      const isPaused = d.paused || false;

      let statusKey, statusParams, statusClass;
      if (isListening && !isPaused) {
        statusKey = "listening";
        statusParams = { source: d.audioSource };
        statusClass = "listening";
      } else if (isListening && isPaused) {
        statusKey = "paused";
        statusClass = "paused";
      } else {
        statusKey = "stopped";
        statusClass = "";
      }

      let listeningSince = state.listeningSince;
      let pausedElapsed = state.pausedElapsed;

      if (!isListening) {
        // Stopped
        listeningSince = null;
        pausedElapsed = 0;
        return {
          ...state,
          isListening,
          isPaused,
          currentSessionId: null,
          pendingAction: false,
          statusKey,
          statusParams,
          statusClass,
          partialResults: {},
          listeningSince,
          pausedElapsed,
          activeContext: null,
        };
      } else if (!state.isListening) {
        // Just started — keep utterances if resuming a selected session
        const isResume = state.selectedSessionId && state.selectedSessionId === d.sessionId;
        return {
          ...state,
          isListening,
          isPaused,
          currentSessionId: d.sessionId,
          selectedSessionId: null,
          selectedSessionData: null,
          pendingAction: false,
          statusKey,
          statusParams,
          statusClass,
          partialResults: {},
          utterances: isResume ? state.utterances : [],
          speakerColorMap: isResume ? state.speakerColorMap : new Map(),
          listeningSince: Date.now(),
          pausedElapsed: 0,
        };
      } else if (isPaused && !state.isPaused) {
        // Just paused — accumulate elapsed so far
        pausedElapsed += listeningSince ? Date.now() - listeningSince : 0;
        listeningSince = null;
      } else if (!isPaused && state.isPaused) {
        // Resumed
        listeningSince = Date.now();
      }

      return {
        ...state,
        isListening,
        isPaused,
        currentSessionId: isListening ? d.sessionId : null,
        pendingAction: false,
        statusKey,
        statusParams,
        statusClass,
        partialResults: {},
        listeningSince,
        pausedElapsed,
      };
    }
    case "UTTERANCE": {
      const d = action.payload;
      const newMap = new Map(state.speakerColorMap);
      getSpeakerIndex(d.speaker, newMap);
      const nextPartials = { ...state.partialResults };
      delete nextPartials[d.source || "mic"];
      return {
        ...state,
        utterances: [...state.utterances, { ...d, _clientId: state.nextUtteranceId }],
        nextUtteranceId: state.nextUtteranceId + 1,
        partialResults: nextPartials,
        speakerColorMap: newMap,
      };
    }
    case "PARTIAL": {
      const d = action.payload;
      const source = d.source || "mic";
      return {
        ...state,
        partialResults: {
          ...state.partialResults,
          [source]: d,
        },
      };
    }
    case "ERROR": {
      const err = action.payload;
      const id = Date.now() + Math.random();
      return {
        ...state,
        pendingAction: false,
        statusKey: "stopped",
        statusClass: "",
        toasts: [...state.toasts, { id, key: err.key || null, params: err.params, message: err.message || null, type: "error" }],
      };
    }
    case "CONNECTED": {
      // Announce recovery once after a reported outage
      const toasts = state.connectionLost
        ? [...state.toasts, newToast({ key: "connectionRestored", type: "success" })]
        : state.toasts;
      const recovered = state.connectionLost
        ? { connectionLost: false, reconnectCount: state.reconnectCount + 1, sessionListVersion: state.sessionListVersion + 1 }
        : {};
      if (!state.isListening) {
        return { ...state, statusKey: "connected", statusClass: "", toasts, ...recovered };
      }
      return state.connectionLost ? { ...state, toasts, ...recovered } : state;
    }
    case "DISCONNECTED":
      return {
        ...state,
        // One toast per outage, not one per reconnect attempt
        connectionLost: true,
        toasts: state.connectionLost
          ? state.toasts
          : [...state.toasts, newToast({ key: "connectionLost", type: "error" })],
        isListening: false,
        isPaused: false,
        pendingAction: false,
        statusKey: "disconnected",
        statusClass: "error",
        listeningSince: null,
        pausedElapsed: 0,
      };
    case "TOAST": {
      const id = Date.now() + Math.random();
      return {
        ...state,
        toasts: [...state.toasts, {
          id,
          key: action.payload.key || null,
          params: action.payload.params,
          error: action.payload.error,
          message: action.payload.message || null,
          type: action.payload.type || "",
        }],
      };
    }
    case "DISMISS_TOAST":
      return { ...state, toasts: state.toasts.filter((t) => t.id !== action.payload) };
    case "SET_PENDING":
      return { ...state, pendingAction: true };
    case "CLEAR_TRANSCRIPT":
      return { ...state, utterances: [], partialResults: {}, speakerColorMap: new Map(), nextUtteranceId: 1 };
    case "SELECT_SESSION": {
      const { sessionId, sessionData, utterances } = action.payload;
      const newMap = new Map();
      let nextId = state.nextUtteranceId;
      const taggedUtterances = utterances.map((u) => {
        const speaker = u.speaker || u.original_speaker;
        if (speaker) getSpeakerIndex(speaker, newMap);
        return { ...u, _clientId: u.id || nextId++ };
      });
      return {
        ...state,
        selectedSessionId: sessionId,
        selectedSessionData: sessionData,
        utterances: taggedUtterances,
        partialResults: {},
        speakerColorMap: newMap,
        nextUtteranceId: nextId,
      };
    }
    case "DESELECT_SESSION":
      return {
        ...state,
        selectedSessionId: null,
        selectedSessionData: null,
        utterances: [],
        partialResults: {},
        speakerColorMap: new Map(),
        nextUtteranceId: 1,
      };
    case "UPDATE_SESSION_DATA":
      return { ...state, selectedSessionData: { ...state.selectedSessionData, ...action.payload } };
    case "REFRESH_SESSION_LIST":
      return { ...state, sessionListVersion: state.sessionListVersion + 1 };
    case "TOGGLE_OVERLAY": {
      return { ...state, overlayVisible: !state.overlayVisible };
    }
    case "UPDATE_OVERLAY_SETTINGS": {
      const overlaySettings = { ...state.overlaySettings, ...action.payload };
      try {
        localStorage.setItem("overlay-settings", JSON.stringify(overlaySettings));
      } catch {
        // Storage full/blocked — the server keeps the authoritative copy
      }
      if (window.electronAPI?.sendOverlaySettings) {
        window.electronAPI.sendOverlaySettings(overlaySettings);
      }
      return { ...state, overlaySettings };
    }
    case "OVERLAY_CLOSED":
      return { ...state, overlayVisible: false };
    case "SET_CONTEXT":
      return { ...state, activeContext: action.payload };
    default:
      return state;
  }
}

// Module-level singleton — survives StrictMode double-mount and HMR
const socket = io({ autoConnect: false });

export function SocketProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const actions = useMemo(() => ({ socket, dispatch }), []);

  // Memoized context slices — only re-create when their specific dependencies change
  const session = useMemo(() => ({
    isListening: state.isListening,
    isPaused: state.isPaused,
    currentSessionId: state.currentSessionId,
    selectedSessionId: state.selectedSessionId,
    selectedSessionData: state.selectedSessionData,
    pendingAction: state.pendingAction,
    activeContext: state.activeContext,
  }), [state.isListening, state.isPaused, state.currentSessionId, state.selectedSessionId, state.selectedSessionData, state.pendingAction, state.activeContext]);

  const transcript = useMemo(() => ({
    utterances: state.utterances,
    partialResults: state.partialResults,
    speakerColorMap: state.speakerColorMap,
  }), [state.utterances, state.partialResults, state.speakerColorMap]);

  const ui = useMemo(() => ({
    statusKey: state.statusKey,
    statusParams: state.statusParams,
    statusClass: state.statusClass,
    toasts: state.toasts,
    overlayVisible: state.overlayVisible,
    overlaySettings: state.overlaySettings,
    sessionListVersion: state.sessionListVersion,
    reconnectCount: state.reconnectCount,
    listeningSince: state.listeningSince,
    pausedElapsed: state.pausedElapsed,
  }), [state.statusKey, state.statusParams, state.statusClass, state.toasts, state.overlayVisible, state.overlaySettings, state.sessionListVersion, state.reconnectCount, state.listeningSince, state.pausedElapsed]);

  useEffect(() => {
    if (!socket.connected && !socket.connecting) socket.connect();

    const fwdOverlay = window.electronAPI?.sendOverlayData;

    socket.on("status", (data) => {
      dispatch({ type: "STATUS", payload: data });
      if (!data.listening && fwdOverlay) {
        fwdOverlay({ type: "clear" });
      }
    });
    socket.on("utterance", (data) => {
      dispatch({ type: "UTTERANCE", payload: data });
      if (fwdOverlay) fwdOverlay({ type: "utterance-clear-partial", payload: data });
    });
    socket.on("partial-result", (data) => {
      dispatch({ type: "PARTIAL", payload: data });
      if (fwdOverlay) fwdOverlay({ type: "partial", payload: data });
    });
    socket.on("error", (data) => dispatch({ type: "ERROR", payload: data }));
    socket.on("connect", () => dispatch({ type: "CONNECTED" }));
    socket.on("disconnect", (reason) => {
      // We closed it ourselves (unmount/HMR) — not an outage
      if (reason === "io client disconnect") return;
      dispatch({ type: "DISCONNECTED" });
      // The server kicked us: socket.io won't retry on its own
      if (reason === "io server disconnect") socket.connect();
    });
    // Initial connect (or a reconnect attempt) failed — the reducer only toasts once per outage
    socket.on("connect_error", (err) => {
      console.warn("[socket] connect_error:", err?.message);
      dispatch({ type: "DISCONNECTED" });
    });

    // If socket connected before useEffect ran (fast localhost), catch up
    if (socket.connected) {
      dispatch({ type: "CONNECTED" });
    }

    // Listen for overlay closed from Electron
    if (window.electronAPI?.onOverlayClosed) {
      window.electronAPI.onOverlayClosed(() => dispatch({ type: "OVERLAY_CLOSED" }));
    }

    // Load overlay settings from server
    fetchOverlaySettings()
      .then((data) => {
        if (data && typeof data === "object" && !data.error) {
          dispatch({ type: "UPDATE_OVERLAY_SETTINGS", payload: data });
        }
      })
      .catch((err) => reportError(dispatch, err, "errLoadOverlaySettings"));

    return () => {
      socket.off();
    };
  }, []);

  return (
    <SocketActionsContext.Provider value={actions}>
      <SessionContext.Provider value={session}>
        <TranscriptContext.Provider value={transcript}>
          <UIContext.Provider value={ui}>
            {children}
          </UIContext.Provider>
        </TranscriptContext.Provider>
      </SessionContext.Provider>
    </SocketActionsContext.Provider>
  );
}

/** Returns stable { socket, dispatch } — does NOT re-render on state changes */
export function useSocketActions() {
  return useContext(SocketActionsContext);
}

/** Session state: isListening, isPaused, currentSessionId, selectedSessionId, selectedSessionData, pendingAction, activeContext */
export function useSession() {
  return useContext(SessionContext);
}

/** Transcript state: utterances, partialResults, speakerColorMap */
export function useTranscript() {
  return useContext(TranscriptContext);
}

/** UI state: statusKey, statusParams, statusClass, toasts, overlayVisible, overlaySettings, sessionListVersion, reconnectCount, listeningSince, pausedElapsed */
export function useUI() {
  return useContext(UIContext);
}

/** Backward-compatible hook — subscribes to ALL state changes. Prefer granular hooks above. */
export function useSocket() {
  const { socket, dispatch } = useContext(SocketActionsContext);
  const session = useContext(SessionContext);
  const transcript = useContext(TranscriptContext);
  const ui = useContext(UIContext);
  return { socket, state: { ...session, ...transcript, ...ui }, dispatch };
}
