import { useState, useEffect, useCallback, useRef } from "react";
import { useSocket } from "../context/SocketContext";
import { fetchSessions, fetchSession, deleteSession } from "../utils/api";
import { SOURCE_LABELS } from "../utils/constants";
import { ConfirmDialog } from "./Modal";

function formatDuration(startedAt, endedAt) {
  if (!endedAt) return "";
  const diffMs = new Date(endedAt + "Z") - new Date(startedAt + "Z");
  const mins = Math.floor(diffMs / 60000);
  const secs = Math.floor((diffMs % 60000) / 1000);
  return mins > 0 ? `${mins}m${secs}s` : `${secs}s`;
}

function SidebarItem({ session, isActive, isSelected, disabled, selectMode, checked, onToggleCheck, onClick }) {
  const startDate = new Date(session.started_at + "Z");
  const date = startDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const time = startDate.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  const title = session.title || `${date} ${time}`;
  const source = SOURCE_LABELS[session.audio_source] || session.audio_source;
  const duration = formatDuration(session.started_at, session.ended_at);

  return (
    <div
      className={`px-3 py-2.5 rounded-xl transition-all duration-200 mb-1 border flex items-center gap-2 ${
        disabled
          ? "opacity-40 cursor-not-allowed"
          : "cursor-pointer"
      } ${
        isSelected
          ? "bg-indigo-500/10 dark:bg-indigo-500/15 border-indigo-500/30 dark:border-indigo-500/20"
          : `bg-transparent border-transparent ${!disabled ? "hover:bg-gray-100/60 dark:hover:bg-white/5" : ""}`
      }`}
      onClick={disabled ? undefined : onClick}
    >
      {selectMode && (
        <input
          type="checkbox"
          className="accent-indigo-500 w-3.5 h-3.5 shrink-0"
          checked={checked}
          onChange={(e) => { e.stopPropagation(); onToggleCheck(session.id); }}
          onClick={(e) => e.stopPropagation()}
        />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          {isActive && (
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
          )}
          <span className="font-medium text-sm text-gray-900 dark:text-gray-200 truncate flex-1">
            {title}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-[0.68rem] text-gray-400 dark:text-gray-600 pl-0">
          <span>{date} {time}</span>
          {duration && <span>· {duration}</span>}
          <span>· {source}</span>
          {session.utterance_count > 0 && <span>· {session.utterance_count} msgs</span>}
        </div>
      </div>
    </div>
  );
}

export default function Sidebar() {
  const { state, dispatch } = useSocket();
  const { isListening, currentSessionId, selectedSessionId } = state;

  const [sessions, setSessions] = useState([]);
  const [collapsed, setCollapsed] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [selectMode, setSelectMode] = useState(false);
  const [checkedIds, setCheckedIds] = useState(new Set());
  const longPressTimer = useRef(null);
  const longPressedRef = useRef(false);

  const loadSessions = useCallback(async () => {
    try {
      const data = await fetchSessions();
      setSessions(data);
    } catch {
      setSessions([]);
    }
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  // Refresh when listening state changes (session started/stopped)
  useEffect(() => {
    loadSessions();
  }, [isListening, loadSessions]);

  const handleLongPress = useCallback((sessionId) => {
    longPressedRef.current = false;
    longPressTimer.current = setTimeout(() => {
      longPressedRef.current = true;
      setSelectMode(true);
      setCheckedIds(new Set([sessionId]));
    }, 500);
  }, []);

  const handleLongPressEnd = useCallback(() => {
    clearTimeout(longPressTimer.current);
  }, []);

  const handleToggleCheck = useCallback((id) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleSelectAll = (checked) => {
    if (checked) {
      setCheckedIds(new Set(sessions.map((s) => s.id)));
    } else {
      setCheckedIds(new Set());
    }
  };

  const handleCancelSelect = () => {
    setSelectMode(false);
    setCheckedIds(new Set());
  };

  const handleBulkDelete = () => {
    if (checkedIds.size === 0) return;
    setConfirmDelete("bulk");
  };

  const handleItemClick = async (sessionId) => {
    if (longPressedRef.current) {
      longPressedRef.current = false;
      return;
    }
    if (selectMode) {
      handleToggleCheck(sessionId);
      return;
    }
    if (isListening) return;
    if (selectedSessionId === sessionId) {
      dispatch({ type: "DESELECT_SESSION" });
      return;
    }
    try {
      const data = await fetchSession(sessionId);
      dispatch({
        type: "SELECT_SESSION",
        payload: { sessionId, sessionData: data, utterances: data.utterances || [] },
      });
    } catch {
      // ignore
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    if (confirmDelete === "bulk") {
      await Promise.all([...checkedIds].map((id) => deleteSession(id)));
      if (checkedIds.has(selectedSessionId)) {
        dispatch({ type: "DESELECT_SESSION" });
      }
      setSelectMode(false);
      setCheckedIds(new Set());
    } else {
      await deleteSession(confirmDelete);
      if (selectedSessionId === confirmDelete) {
        dispatch({ type: "DESELECT_SESSION" });
      }
    }
    setConfirmDelete(null);
    loadSessions();
  };

  if (collapsed) {
    return (
      <div className="flex flex-col items-center py-4 px-1 w-10 shrink-0">
        <button
          className="bg-transparent border-none cursor-pointer text-gray-400 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-400 transition-colors p-1 rounded-lg hover:bg-gray-100/60 dark:hover:bg-white/5"
          onClick={() => setCollapsed(false)}
          title="Show sessions"
        >
          ▶
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-64 shrink-0 border-r border-gray-200/50 dark:border-indigo-500/10 pr-3 mr-3">
      {/* Header */}
      <div className="flex items-center justify-between py-3 px-1">
        <span className="font-semibold text-sm text-gray-700 dark:text-gray-300">Sessions</span>
        <button
          className="bg-transparent border-none cursor-pointer text-gray-400 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-400 transition-colors p-1 rounded-lg hover:bg-gray-100/60 dark:hover:bg-white/5 text-xs"
          onClick={() => setCollapsed(true)}
          title="Hide sessions"
        >
          ◀
        </button>
      </div>

      {/* Select mode toolbar */}
      {selectMode && (
        <div className="flex items-center gap-1.5 px-1 pb-2 text-xs">
          <label className="flex items-center gap-1 text-gray-500 dark:text-gray-400 cursor-pointer">
            <input
              type="checkbox"
              className="accent-indigo-500 w-3.5 h-3.5"
              checked={checkedIds.size === sessions.length && sessions.length > 0}
              onChange={(e) => handleSelectAll(e.target.checked)}
            />
            All
          </label>
          <span className="text-cyan-500 font-medium text-[0.68rem]">
            {checkedIds.size > 0 ? `${checkedIds.size}` : ""}
          </span>
          <button
            className="bg-linear-to-r from-rose-600 to-pink-500 text-white border-none px-2 py-1 rounded-lg cursor-pointer text-[0.68rem] font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
            disabled={checkedIds.size === 0}
            onClick={handleBulkDelete}
          >
            Delete
          </button>
          <button
            className="bg-gray-100/80 dark:bg-white/5 text-gray-500 dark:text-gray-400 border border-gray-200/50 dark:border-indigo-500/10 px-2 py-1 rounded-lg cursor-pointer text-[0.68rem] transition-all hover:bg-gray-200/80 dark:hover:bg-white/10 active:scale-95"
            onClick={handleCancelSelect}
          >
            Cancel
          </button>
        </div>
      )}

      {/* Session list */}
      <div className="flex-1 overflow-y-auto">
        {sessions.length === 0 ? (
          <div className="text-gray-300 dark:text-gray-700 text-center py-10 text-xs">
            No sessions yet
          </div>
        ) : (
          sessions.map((s) => (
            <div
              key={s.id}
              onMouseDown={() => handleLongPress(s.id)}
              onMouseUp={handleLongPressEnd}
              onMouseLeave={handleLongPressEnd}
              onTouchStart={() => handleLongPress(s.id)}
              onTouchEnd={handleLongPressEnd}
              onTouchCancel={handleLongPressEnd}
            >
              <SidebarItem
                session={s}
                isActive={currentSessionId === s.id}
                isSelected={selectedSessionId === s.id}
                disabled={isListening && currentSessionId !== s.id}
                selectMode={selectMode}
                checked={checkedIds.has(s.id)}
                onToggleCheck={handleToggleCheck}
                onClick={() => handleItemClick(s.id)}
              />
            </div>
          ))
        )}
      </div>

      <ConfirmDialog
        open={!!confirmDelete}
        title={confirmDelete === "bulk" ? "Delete sessions" : "Delete session"}
        message={confirmDelete === "bulk"
          ? `Are you sure you want to delete ${checkedIds.size} session(s)? This action cannot be undone.`
          : "Are you sure you want to delete this session? This action cannot be undone."}
        confirmLabel="Delete"
        confirmColor="red"
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(null)}
      />

    </div>
  );
}
