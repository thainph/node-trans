import { createContext, useContext, useReducer, useEffect, useMemo } from "react";
import { io } from "socket.io-client";
import { getSpeakerIndex } from "../utils/speakerColors";

const SocketContext = createContext(null);

const initialState = {
  isListening: false,
  isPaused: false,
  currentSessionId: null,
  selectedSessionId: null,
  selectedSessionData: null,
  pendingAction: false,
  statusText: "Connecting...",
  statusClass: "",
  utterances: [],
  partialResult: null,
  speakerColorMap: new Map(),
  listeningSince: null,
  pausedElapsed: 0,
};

function reducer(state, action) {
  switch (action.type) {
    case "STATUS": {
      const d = action.payload;
      const isListening = d.listening;
      const isPaused = d.paused || false;

      let statusText, statusClass;
      if (isListening && !isPaused) {
        statusText = `Listening (${d.audioSource})`;
        statusClass = "listening";
      } else if (isListening && isPaused) {
        statusText = "Paused";
        statusClass = "paused";
      } else {
        statusText = "Stopped";
        statusClass = "";
      }

      let listeningSince = state.listeningSince;
      let pausedElapsed = state.pausedElapsed;

      if (!isListening) {
        // Stopped
        listeningSince = null;
        pausedElapsed = 0;
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
          statusText,
          statusClass,
          partialResult: null,
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
        statusText,
        statusClass,
        partialResult: null,
        listeningSince,
        pausedElapsed,
      };
    }
    case "UTTERANCE": {
      const d = action.payload;
      const newMap = new Map(state.speakerColorMap);
      getSpeakerIndex(d.speaker, newMap);
      return {
        ...state,
        utterances: [...state.utterances, d],
        partialResult: null,
        speakerColorMap: newMap,
      };
    }
    case "PARTIAL":
      return { ...state, partialResult: action.payload };
    case "ERROR":
      return {
        ...state,
        pendingAction: false,
        statusText: action.payload.message,
        statusClass: "error",
      };
    case "CONNECTED":
      if (!state.isListening) {
        return { ...state, statusText: "Connected", statusClass: "" };
      }
      return state;
    case "DISCONNECTED":
      return {
        ...state,
        isListening: false,
        isPaused: false,
        statusText: "Disconnected",
        statusClass: "error",
        listeningSince: null,
        pausedElapsed: 0,
      };
    case "SET_PENDING":
      return { ...state, pendingAction: true };
    case "CLEAR_TRANSCRIPT":
      return { ...state, utterances: [], partialResult: null, speakerColorMap: new Map() };
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
        partialResult: null,
        speakerColorMap: newMap,
      };
    }
    case "DESELECT_SESSION":
      return {
        ...state,
        selectedSessionId: null,
        selectedSessionData: null,
        utterances: [],
        partialResult: null,
        speakerColorMap: new Map(),
      };
    default:
      return state;
  }
}

export function SocketProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const socket = useMemo(() => io(), []);

  useEffect(() => {
    socket.on("status", (data) => dispatch({ type: "STATUS", payload: data }));
    socket.on("utterance", (data) => dispatch({ type: "UTTERANCE", payload: data }));
    socket.on("partial-result", (data) => dispatch({ type: "PARTIAL", payload: data }));
    socket.on("error", (data) => dispatch({ type: "ERROR", payload: data }));
    socket.on("connect", () => dispatch({ type: "CONNECTED" }));
    socket.on("disconnect", () => dispatch({ type: "DISCONNECTED" }));

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
