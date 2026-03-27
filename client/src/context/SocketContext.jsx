import { createContext, useContext, useReducer, useEffect, useMemo } from "react";
import { io } from "socket.io-client";
import { getSpeakerIndex } from "../utils/speakerColors";

const SocketContext = createContext(null);

const OVERLAY_DEFAULTS = {
  opacity: 0.8,
  scale: 1,
  displayMode: "both",
  textAlign: "left",
  bgColor: "dark",
  maxLines: 5,
  fontFamily: "system-ui, sans-serif",
};

function loadOverlaySettings() {
  try {
    const saved = localStorage.getItem("overlay-settings");
    if (saved) return { ...OVERLAY_DEFAULTS, ...JSON.parse(saved) };
  } catch {}
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
  utterances: [],
  partialResults: {},
  speakerColorMap: new Map(),
  listeningSince: null,
  pausedElapsed: 0,
  sessionListVersion: 0,
  overlayVisible: false,
  overlaySettings: loadOverlaySettings(),
  activeContext: null,
};

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
        utterances: [...state.utterances, d],
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
      return {
        ...state,
        pendingAction: false,
        statusKey: err.key || null,
        statusParams: err.params || undefined,
        statusText: err.key ? null : err.message,
        statusClass: "error",
      };
    }
    case "CONNECTED":
      if (!state.isListening) {
        return { ...state, statusKey: "connected", statusClass: "" };
      }
      return state;
    case "DISCONNECTED":
      return {
        ...state,
        isListening: false,
        isPaused: false,
        statusKey: "disconnected",
        statusClass: "error",
        listeningSince: null,
        pausedElapsed: 0,
      };
    case "TOAST":
      return {
        ...state,
        statusKey: null,
        statusText: action.payload.message,
        statusClass: action.payload.type || "",
      };
    case "SET_PENDING":
      return { ...state, pendingAction: true };
    case "CLEAR_TRANSCRIPT":
      return { ...state, utterances: [], partialResults: {}, speakerColorMap: new Map() };
    case "SELECT_SESSION": {
      const { sessionId, sessionData, utterances } = action.payload;
      const newMap = new Map();
      for (const u of utterances) {
        const speaker = u.speaker || u.original_speaker;
        if (speaker) getSpeakerIndex(speaker, newMap);
      }
      return {
        ...state,
        selectedSessionId: sessionId,
        selectedSessionData: sessionData,
        utterances,
        partialResults: {},
        speakerColorMap: newMap,
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
      };
    case "REFRESH_SESSION_LIST":
      return { ...state, sessionListVersion: state.sessionListVersion + 1 };
    case "TOGGLE_OVERLAY": {
      return { ...state, overlayVisible: !state.overlayVisible };
    }
    case "UPDATE_OVERLAY_SETTINGS": {
      const overlaySettings = { ...state.overlaySettings, ...action.payload };
      localStorage.setItem("overlay-settings", JSON.stringify(overlaySettings));
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

export function SocketProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const socket = useMemo(() => io(), []);

  useEffect(() => {
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
    socket.on("disconnect", () => dispatch({ type: "DISCONNECTED" }));

    // Listen for overlay closed from Electron
    if (window.electronAPI?.onOverlayClosed) {
      window.electronAPI.onOverlayClosed(() => dispatch({ type: "OVERLAY_CLOSED" }));
    }

    // Load overlay settings from server
    fetch("/api/settings/overlay", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (data && typeof data === "object" && !data.error) {
          dispatch({ type: "UPDATE_OVERLAY_SETTINGS", payload: data });
        }
      })
      .catch(() => {});

    return () => {
      socket.off();
      socket.disconnect();
    };
  }, [socket]);

  const value = useMemo(() => ({ socket, state, dispatch }), [socket, state]);

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  return useContext(SocketContext);
}
