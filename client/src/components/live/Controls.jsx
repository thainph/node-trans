import { useState, useEffect } from "react";
import { useSocket } from "../../context/SocketContext";
import { deleteSession, renameSession, getExportUrl } from "../../utils/api";
import { ConfirmDialog, PromptDialog } from "../Modal";

const btnBase = "px-5 py-2 rounded-xl text-sm font-semibold transition-all duration-200 cursor-pointer border-none whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 text-white";
const btnAction = "bg-transparent border-none cursor-pointer text-sm px-2 py-1 rounded-lg transition-all duration-200 hover:bg-gray-100/60 dark:hover:bg-white/5 active:scale-95 text-gray-500 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300";

function formatDuration(ms) {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

export default function Controls() {
  const { socket, state, dispatch } = useSocket();
  const { isListening, isPaused, pendingAction, listeningSince, pausedElapsed } = state;

  const [elapsed, setElapsed] = useState(0);
  const [renameModal, setRenameModal] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

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

  const emit = (event) => {
    if (pendingAction) return;
    dispatch({ type: "SET_PENDING" });
    socket.emit(event);
  };

  const handleToggle = () => {
    if (pendingAction) return;
    dispatch({ type: "SET_PENDING" });
    if (isListening) {
      socket.emit("stop-listening");
    } else if (state.selectedSessionId) {
      socket.emit("start-listening", { sessionId: state.selectedSessionId });
    } else {
      socket.emit("start-listening");
    }
  };

  const handleNewMeeting = () => {
    if (pendingAction) return;
    dispatch({ type: "SET_PENDING" });
    socket.emit("stop-listening");
    dispatch({ type: "CLEAR_TRANSCRIPT" });
    setTimeout(() => socket.emit("start-listening"), 200);
  };

  const loadingCls = pendingAction ? " btn-loading" : "";

  return (
    <div className="py-2.5 flex items-center gap-3 flex-wrap">
      <button
        className={`${btnBase} ${isListening ? "bg-linear-to-r from-rose-600 to-pink-500 shadow-lg shadow-rose-500/25 hover:shadow-xl hover:shadow-rose-500/30" : "bg-linear-to-r from-indigo-600 to-cyan-500 shadow-lg shadow-indigo-500/25 hover:shadow-xl hover:shadow-indigo-500/30"}${loadingCls}`}
        disabled={pendingAction}
        onClick={handleToggle}
      >
        {isListening ? "⏹ Stop" : state.selectedSessionId ? "▶ Resume" : "▶ Start"}
      </button>

      {!isListening && state.selectedSessionId && (
        <>
          <button
            className={`${btnBase} text-gray-700! dark:text-gray-300! bg-gray-100/80 dark:bg-white/5 border border-gray-200/60 dark:border-indigo-500/10 hover:bg-gray-200/80 dark:hover:bg-white/10`}
            onClick={() => dispatch({ type: "DESELECT_SESSION" })}
          >
            ⊕ New Session
          </button>
          <div className="flex items-center gap-0.5 ml-auto">
            <button className={btnAction} title="Rename" onClick={() => {
              const d = state.selectedSessionData;
              const title = d?.title || new Date(d?.started_at + "Z").toLocaleString("en-US");
              setRenameModal({ value: title });
            }}>
              🖊️
            </button>
            <button className={btnAction} title="Export" onClick={() => window.open(getExportUrl(state.selectedSessionId), "_blank")}>
              📥
            </button>
            <button className={`${btnAction} hover:text-red-500! dark:hover:text-red-400!`} title="Delete" onClick={() => setConfirmDelete(true)}>
              🗑
            </button>
          </div>
        </>
      )}

      {isListening && !isPaused && (
        <button
          className={`${btnBase} bg-linear-to-r from-amber-500 to-orange-500 shadow-lg shadow-amber-500/25 hover:shadow-xl hover:shadow-amber-500/30${loadingCls}`}
          disabled={pendingAction}
          onClick={() => emit("pause-listening")}
        >
          ⏸ Pause
        </button>
      )}

      {isListening && isPaused && (
        <>
          <button
            className={`${btnBase} bg-linear-to-r from-emerald-500 to-teal-500 shadow-lg shadow-emerald-500/25 hover:shadow-xl hover:shadow-emerald-500/30${loadingCls}`}
            disabled={pendingAction}
            onClick={() => emit("resume-listening")}
          >
            ▶ Resume
          </button>
          <button
            className={`${btnBase} text-gray-700! dark:text-gray-300! bg-gray-100/80 dark:bg-white/5 border border-gray-200/60 dark:border-indigo-500/10 hover:bg-gray-200/80 dark:hover:bg-white/10${loadingCls}`}
            disabled={pendingAction}
            onClick={handleNewMeeting}
          >
            ⊕ New Meeting
          </button>
        </>
      )}

      {isListening && (
        <span className="ml-auto text-base font-mono text-gray-500 dark:text-gray-400 tabular-nums">
          {formatDuration(elapsed)}
        </span>
      )}

      <ConfirmDialog
        open={confirmDelete}
        title="Delete session"
        message="Are you sure you want to delete this session? This action cannot be undone."
        confirmLabel="Delete"
        confirmColor="red"
        onConfirm={async () => {
          const id = state.selectedSessionId;
          setConfirmDelete(false);
          await deleteSession(id);
          dispatch({ type: "DESELECT_SESSION" });
        }}
        onCancel={() => setConfirmDelete(false)}
      />

      <PromptDialog
        open={!!renameModal}
        title="Rename session"
        defaultValue={renameModal?.value || ""}
        onCancel={() => setRenameModal(null)}
        onConfirm={async (newTitle) => {
          setRenameModal(null);
          await renameSession(state.selectedSessionId, newTitle);
          // Refresh session data in state
          dispatch({
            type: "SELECT_SESSION",
            payload: {
              sessionId: state.selectedSessionId,
              sessionData: { ...state.selectedSessionData, title: newTitle },
              utterances: state.utterances,
            },
          });
        }}
      />
    </div>
  );
}
