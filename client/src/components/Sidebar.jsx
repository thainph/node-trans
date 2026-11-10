import { useState, useEffect, useCallback, useRef } from "react";
import { useSocketActions, useSession, useUI } from "../context/SocketContext";
import { useI18n } from "../i18n/I18nContext";
import { fetchSessions, fetchSession, deleteSession } from "../utils/api";
import { ConfirmDialog } from "./Modal";
import ExportDialog from "./live/ExportDialog";

function formatDuration(startedAt, endedAt) {
  if (!endedAt) return "";
  const diffMs = new Date(endedAt + "Z") - new Date(startedAt + "Z");
  const mins = Math.floor(diffMs / 60000);
  const secs = Math.floor((diffMs % 60000) / 1000);
  return mins > 0 ? `${mins}m${secs}s` : `${secs}s`;
}

function SidebarItem({ session, isActive, isSelected, disabled, selectMode, checked, onToggleCheck, onClick }) {
  const { t } = useI18n();
  const startDate = new Date(session.started_at + "Z");
  const date = startDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const time = startDate.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  const title = session.title || `${date} ${time}`;
  const duration = formatDuration(session.started_at, session.ended_at);

  const meta = [];
  meta.push(`${date} ${time}`);
  if (duration) meta.push(duration);

  return (
    <div
      className={`px-3 py-2 rounded-xl transition-all duration-200 mb-0.5 border flex items-center gap-2 ${
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
        <div className="flex items-center gap-1.5">
          {isActive && (
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
          )}
          <span className="font-medium text-sm text-gray-800 dark:text-gray-100">
            {title}
          </span>
        </div>
        <div className="flex items-center gap-1 mt-0.5 text-[0.7rem] text-gray-500 dark:text-gray-400">
          {meta.map((item, i) => (
            <span key={i} className="flex items-center gap-1">
              {i > 0 && <span className="text-gray-300 dark:text-gray-600">·</span>}
              {item}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Sidebar() {
  const { dispatch } = useSocketActions();
  const { isListening, currentSessionId, selectedSessionId } = useSession();
  const { sessionListVersion } = useUI();
  const { t } = useI18n();

  const [sessions, setSessions] = useState([]);
  const [collapsed, setCollapsed] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [selectMode, setSelectMode] = useState(false);
  const [checkedIds, setCheckedIds] = useState(new Set());
  const [exportIds, setExportIds] = useState(null);
  const longPressTimer = useRef(null);
  const longPressedRef = useRef(false);

  // Reload sessions on mount, when listening state changes, or when sessionListVersion changes
  useEffect(() => {
    let cancelled = false;
    fetchSessions()
      .then((data) => { if (!cancelled) setSessions(data); })
      .catch(() => { if (!cancelled) setSessions([]); });
    return () => { cancelled = true; };
  }, [isListening, sessionListVersion]);

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
    // Prevent deleting the currently active (recording) session
    if (currentSessionId && checkedIds.has(currentSessionId)) {
      const next = new Set(checkedIds);
      next.delete(currentSessionId);
      setCheckedIds(next);
      if (next.size === 0) return;
    }
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
    const idsToDelete = confirmDelete === "bulk"
      ? [...checkedIds].filter((id) => id !== currentSessionId)
      : confirmDelete !== currentSessionId ? [confirmDelete] : [];

    // Close dialog & exit select mode immediately
    setConfirmDelete(null);
    setSelectMode(false);
    setCheckedIds(new Set());

    if (idsToDelete.length === 0) return;

    // Delete from server
    try {
      await Promise.all(idsToDelete.map((id) => deleteSession(id)));
    } catch {
      // ignore
    }

    // Clear live tab if not currently recording
    if (!isListening) {
      dispatch({ type: "CLEAR_TRANSCRIPT" });
      dispatch({ type: "DESELECT_SESSION" });
    } else if (selectedSessionId) {
      dispatch({ type: "DESELECT_SESSION" });
    }

    // Trigger session list refresh globally
    dispatch({ type: "REFRESH_SESSION_LIST" });
  };

  const contentVisible = !collapsed;

  return (
    <div
      className="flex flex-col shrink-0 border-r border-gray-200/50 dark:border-indigo-500/10 overflow-hidden"
      style={{
        width: collapsed ? 40 : 256,
        paddingRight: collapsed ? 0 : 12,
        marginRight: 12,
        transition: "width 300ms cubic-bezier(0.4, 0, 0.2, 1), padding-right 300ms cubic-bezier(0.4, 0, 0.2, 1)",
      }}
    >
      {/* Header — matches Header.jsx (pb-3 border-b, no top padding) */}
      <div className="flex items-center gap-2 pb-3 border-b border-gray-200/60 dark:border-indigo-500/10 px-1">
        <button
          className="shrink-0 bg-transparent border-none cursor-pointer text-gray-400 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-400 transition-all duration-200 p-1.5 rounded-lg hover:bg-gray-100/60 dark:hover:bg-white/5 hover:scale-110 active:scale-95"
          onClick={() => setCollapsed(!collapsed)}
          title={collapsed ? t("showSessions") : t("hideSessions")}
        >
          {collapsed ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="3" />
              <line x1="9" y1="3" x2="9" y2="21" />
              <polyline points="14 9 17 12 14 15" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="3" />
              <line x1="9" y1="3" x2="9" y2="21" />
              <polyline points="16 9 13 12 16 15" />
            </svg>
          )}
        </button>
        <span
          className="font-semibold text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap"
          style={{
            opacity: contentVisible ? 1 : 0,
            transition: "opacity 200ms ease",
            pointerEvents: contentVisible ? "auto" : "none",
          }}
        >
          {t("sessions")}
        </span>
      </div>

      {/* Select mode toolbar */}
      {selectMode && (
        <div
          className="flex items-center gap-1.5 px-1 pb-2 text-xs"
          style={{
            opacity: contentVisible ? 1 : 0,
            pointerEvents: contentVisible ? "auto" : "none",
            transition: "opacity 150ms ease",
          }}
        >
          <label className="flex items-center gap-1 text-gray-500 dark:text-gray-400 cursor-pointer">
            <input
              type="checkbox"
              className="accent-indigo-500 w-3.5 h-3.5"
              checked={checkedIds.size === sessions.length && sessions.length > 0}
              onChange={(e) => handleSelectAll(e.target.checked)}
            />
            {t("all")}
          </label>
          <span className="text-cyan-500 font-medium text-[0.68rem]">
            {checkedIds.size > 0 ? `${checkedIds.size}` : ""}
          </span>
          <button
            className="bg-linear-to-r from-indigo-600 to-cyan-500 text-white border-none px-2 py-1 rounded-lg cursor-pointer text-[0.68rem] font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
            disabled={checkedIds.size === 0}
            onClick={() => setExportIds([...checkedIds])}
          >
            {t("export")}
          </button>
          <button
            className="bg-linear-to-r from-rose-600 to-pink-500 text-white border-none px-2 py-1 rounded-lg cursor-pointer text-[0.68rem] font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
            disabled={checkedIds.size === 0}
            onClick={handleBulkDelete}
          >
            {t("delete")}
          </button>
          <button
            className="bg-gray-100/80 dark:bg-white/5 text-gray-500 dark:text-gray-400 border border-gray-200/50 dark:border-indigo-500/10 px-2 py-1 rounded-lg cursor-pointer text-[0.68rem] transition-all hover:bg-gray-200/80 dark:hover:bg-white/10 active:scale-95"
            onClick={handleCancelSelect}
          >
            {t("cancel")}
          </button>
        </div>
      )}

      {/* Session list */}
      <div
        className="flex-1 overflow-y-auto"
        style={{
          opacity: contentVisible ? 1 : 0,
          pointerEvents: contentVisible ? "auto" : "none",
          transition: "opacity 200ms ease",
        }}
      >
        {sessions.length === 0 ? (
          <div className="text-gray-300 dark:text-gray-700 text-center py-10 text-xs">
            {t("noSessions")}
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
        title={confirmDelete === "bulk" ? t("deleteSessions") : t("deleteSession")}
        message={confirmDelete === "bulk"
          ? t("deleteSessionsConfirm", { count: checkedIds.size })
          : t("deleteSessionConfirm")}
        confirmLabel={t("delete")}
        confirmColor="red"
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(null)}
      />

      <ExportDialog
        open={!!exportIds}
        sessionIds={exportIds || []}
        onClose={() => setExportIds(null)}
        onExported={handleCancelSelect}
      />
    </div>
  );
}
