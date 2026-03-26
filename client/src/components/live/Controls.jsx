import { useState, useEffect } from "react";
import { useSocket } from "../../context/SocketContext";

const btnBase = "px-5 py-2 rounded-xl text-sm font-semibold transition-all duration-200 cursor-pointer border-none whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 text-white";

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
    socket.emit(isListening ? "stop-listening" : "start-listening");
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
        {isListening ? "⏹ Stop" : "▶ Start"}
      </button>

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
    </div>
  );
}
