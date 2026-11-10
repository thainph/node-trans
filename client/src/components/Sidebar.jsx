import { useState, useEffect, useMemo, useRef } from "react";
import { Search } from "lucide-react";
import { useSocketActions, useSession, useUI } from "../context/SocketContext";
import { useI18n } from "../i18n/I18nContext";
import { useCommand } from "../hooks/useCommand";
import { showContextMenu } from "../utils/contextMenu";
import { fetchSessions, fetchSession, deleteSession, renameSession } from "../utils/api";
import { ConfirmDialog, PromptDialog } from "./Modal";
import ExportDialog from "./live/ExportDialog";

const SIDEBAR_WIDTH = 256; // 240px glass panel + 8px inset on each side
const DAY_MS = 86400000;

function formatDuration(startedAt, endedAt) {
  if (!endedAt) return "";
  const diffMs = new Date(endedAt + "Z") - new Date(startedAt + "Z");
  const mins = Math.floor(diffMs / 60000);
  const secs = Math.floor((diffMs % 60000) / 1000);
  return mins > 0 ? `${mins}m${secs}s` : `${secs}s`;
}

// Bucket sessions like Notes/Finder: Today, Yesterday, Previous 7/30 Days, then "Month Year"
function groupSessions(sessions, t, locale) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const groups = [];
  const byKey = new Map();

  for (const s of sessions) {
    const d = new Date(s.started_at + "Z");
    const day = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const age = Math.round((today - day) / DAY_MS);
    let key, label, recent = true;
    if (age <= 0) { key = "today"; label = t("sidebarToday"); }
    else if (age === 1) { key = "yesterday"; label = t("sidebarYesterday"); }
    else if (age <= 7) { key = "prev7"; label = t("sidebarPrev7Days"); recent = false; }
    else if (age <= 30) { key = "prev30"; label = t("sidebarPrev30Days"); recent = false; }
    else {
      key = `${d.getFullYear()}-${d.getMonth()}`;
      label = d.toLocaleDateString(locale, { month: "long", year: "numeric" });
      recent = false;
    }
    if (!byKey.has(key)) {
      const group = { key, label, recent, sessions: [] };
      byKey.set(key, group);
      groups.push(group);
    }
    byKey.get(key).sessions.push(s);
  }
  return groups;
}

function SidebarRow({ session, locale, showDate, selected, recording, disabled, onClick, onContextMenu }) {
  const startDate = new Date(session.started_at + "Z");
  const date = startDate.toLocaleDateString(locale, { month: "short", day: "numeric" });
  const time = startDate.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  const title = session.title || `${date} ${time}`;
  const duration = formatDuration(session.started_at, session.ended_at);
  const secondary = [showDate ? `${date}, ${time}` : time, duration].filter(Boolean).join(" · ");

  return (
    <div
      role="option"
      aria-selected={selected}
      aria-disabled={disabled || undefined}
      className={`list-row flex-col items-stretch gap-0 py-[6px] mb-0.5 ${disabled ? "opacity-40" : ""}`}
      onClick={onClick}
      onContextMenu={onContextMenu}
    >
      <div className="flex items-center gap-1.5 min-w-0">
        {recording && (
          <span className="w-1.5 h-1.5 rounded-full bg-sys-red shrink-0 animate-[recording-pulse_1.6s_ease-in-out_infinite]" />
        )}
        <span className="text-[13px] truncate">{title}</span>
      </div>
      {/* Utilities outrank the .row-secondary component rule, so re-apply the on-accent tint here */}
      <div className={`row-secondary text-[11px] text-label-2 truncate ${selected ? "in-[.window-focused]:text-white/75" : ""}`}>
        {secondary}
      </div>
    </div>
  );
}

export default function Sidebar({ open = true }) {
  const { dispatch } = useSocketActions();
  const { isListening, currentSessionId, selectedSessionId } = useSession();
  const { sessionListVersion } = useUI();
  const { t, lang } = useI18n();
  const locale = lang === "vi" ? "vi-VN" : "en-US";

  const [sessions, setSessions] = useState([]);
  const [query, setQuery] = useState("");
  const [multiIds, setMultiIds] = useState(() => new Set());
  const [confirmDelete, setConfirmDelete] = useState(null); // session id | "bulk"
  const [exportIds, setExportIds] = useState(null);
  const [renameTarget, setRenameTarget] = useState(null); // session
  const anchorRef = useRef(null);
  const searchRef = useRef(null);

  const isMacElectron = typeof document !== "undefined" &&
    document.documentElement.dataset.platform === "darwin" &&
    "electron" in document.documentElement.dataset;

  // Reload sessions on mount, when listening state changes, or when sessionListVersion changes
  useEffect(() => {
    let cancelled = false;
    fetchSessions()
      .then((data) => { if (!cancelled) setSessions(data); })
      .catch(() => { if (!cancelled) setSessions([]); });
    return () => { cancelled = true; };
  }, [isListening, sessionListVersion]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sessions;
    return sessions.filter((s) => (s.title || "").toLowerCase().includes(q));
  }, [sessions, query]);

  const groups = useMemo(() => groupSessions(filtered, t, locale), [filtered, t, locale]);

  // Drop ids from the multi-selection once their session disappears (deleted elsewhere)
  useEffect(() => {
    setMultiIds((prev) => {
      if (prev.size === 0) return prev;
      const ids = new Set(sessions.map((s) => s.id));
      const next = new Set([...prev].filter((id) => ids.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [sessions]);

  const dialogOpen = !!confirmDelete || !!exportIds || !!renameTarget;

  // Escape clears the multi-selection
  useEffect(() => {
    if (multiIds.size === 0 || dialogOpen) return;
    const onKey = (e) => {
      if (e.key === "Escape") setMultiIds(new Set());
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [multiIds, dialogOpen]);

  useCommand("find", () => {
    if (!open) return false;
    searchRef.current?.focus();
    searchRef.current?.select();
  });

  const clearMulti = () => setMultiIds(new Set());

  const openSession = async (sessionId, { toggle = true } = {}) => {
    if (isListening) return;
    if (selectedSessionId === sessionId) {
      if (toggle) dispatch({ type: "DESELECT_SESSION" });
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

  const handleRowClick = (e, session) => {
    const id = session.id;
    const mod = e.metaKey || e.ctrlKey;

    if (mod) {
      setMultiIds((prev) => {
        const next = new Set(prev);
        // First Cmd-click extends from the currently opened session, like Finder
        if (next.size === 0 && selectedSessionId && selectedSessionId !== id) next.add(selectedSessionId);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
      anchorRef.current = id;
      return;
    }

    if (e.shiftKey) {
      const order = filtered.map((s) => s.id);
      const anchor = anchorRef.current ?? selectedSessionId;
      const from = order.indexOf(anchor);
      const to = order.indexOf(id);
      if (from === -1) {
        setMultiIds(new Set([id]));
        anchorRef.current = id;
      } else {
        const [a, b] = from < to ? [from, to] : [to, from];
        setMultiIds(new Set(order.slice(a, b + 1)));
      }
      return;
    }

    clearMulti();
    anchorRef.current = id;
    if (isListening && currentSessionId !== id) return;
    openSession(id);
  };

  const requestBulkDelete = (ids) => {
    // Never delete the currently active (recording) session
    const next = new Set([...ids].filter((id) => id !== currentSessionId));
    setMultiIds(next);
    if (next.size === 0) return;
    setConfirmDelete("bulk");
  };

  const handleRowContextMenu = async (e, session) => {
    const id = session.id;

    if (multiIds.size > 1 && multiIds.has(id)) {
      const count = multiIds.size;
      const deletable = [...multiIds].some((x) => x !== currentSessionId);
      const choice = await showContextMenu(e, [
        { id: "export", label: t("sidebarExportN", { count }) },
        { type: "separator" },
        { id: "delete", label: t("sidebarDeleteN", { count }), disabled: !deletable },
      ]);
      if (choice === "export") setExportIds([...multiIds]);
      else if (choice === "delete") requestBulkDelete(multiIds);
      return;
    }

    const isRecording = id === currentSessionId;
    const choice = await showContextMenu(e, [
      { id: "open", label: t("sidebarOpen"), disabled: isListening },
      { id: "rename", label: t("sidebarRename") },
      { id: "export", label: t("sidebarExport") },
      { type: "separator" },
      { id: "delete", label: t("sidebarDelete"), disabled: isRecording },
    ]);
    if (choice === "open") openSession(id, { toggle: false });
    else if (choice === "rename") setRenameTarget(session);
    else if (choice === "export") setExportIds([id]);
    else if (choice === "delete" && !isRecording) setConfirmDelete(id);
  };

  const handleRename = async (newTitle) => {
    const target = renameTarget;
    setRenameTarget(null);
    if (!target) return;
    try {
      await renameSession(target.id, newTitle);
    } catch {
      return;
    }
    if (target.id === selectedSessionId) {
      dispatch({ type: "UPDATE_SESSION_DATA", payload: { title: newTitle } });
    }
    dispatch({ type: "REFRESH_SESSION_LIST" });
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    const idsToDelete = confirmDelete === "bulk"
      ? [...multiIds].filter((id) => id !== currentSessionId)
      : confirmDelete !== currentSessionId ? [confirmDelete] : [];

    // Close dialog & clear the multi-selection immediately
    setConfirmDelete(null);
    clearMulti();

    if (idsToDelete.length === 0) return;

    // Delete from server
    try {
      await Promise.all(idsToDelete.map((id) => deleteSession(id)));
    } catch {
      // ignore
    }

    // Only clear the transcript when the session on screen was deleted — never while recording,
    // since DESELECT_SESSION also wipes the live utterances
    if (!isListening && selectedSessionId && idsToDelete.includes(selectedSessionId)) {
      dispatch({ type: "CLEAR_TRANSCRIPT" });
      dispatch({ type: "DESELECT_SESSION" });
    }

    // Trigger session list refresh globally
    dispatch({ type: "REFRESH_SESSION_LIST" });
  };

  const multiActive = multiIds.size > 0;
  const showBulkBar = multiIds.size > 1;

  return (
    <>
      <aside
        className="shrink-0 overflow-hidden"
        style={{ width: open ? SIDEBAR_WIDTH : 0, transition: "width 200ms ease-out" }}
        aria-hidden={!open || undefined}
        inert={!open}
      >
        <div className="sidebar-surface bg-window h-full p-2" style={{ width: SIDEBAR_WIDTH }}>
        <div className="glass-panel flex flex-col h-full overflow-hidden">
          {/* Title bar strip — traffic lights live here on macOS */}
          <div className="drag h-[44px] shrink-0 flex items-center pl-3.5">
            {!isMacElectron && (
              <span className="text-[13px] font-semibold text-label">{t("sessions")}</span>
            )}
          </div>

          {/* Search */}
          <div className="px-2 pb-2 shrink-0">
            <div className="relative">
              <Search
                size={14}
                strokeWidth={1.75}
                className="absolute left-2 top-1/2 -translate-y-1/2 text-label-3 pointer-events-none"
              />
              <input
                ref={searchRef}
                type="text"
                className="field w-full pl-7"
                placeholder={t("sidebarSearch")}
                aria-label={t("sidebarSearch")}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape" && query) {
                    e.stopPropagation();
                    setQuery("");
                  }
                }}
              />
            </div>
          </div>

          {/* Session list */}
          <div
            className="flex-1 overflow-y-auto px-2 pb-2"
            role="listbox"
            aria-label={t("sessions")}
            aria-multiselectable="true"
          >
            {groups.length === 0 ? (
              <div className="h-full flex items-center justify-center text-label-3 text-[13px] text-center px-4">
                {sessions.length === 0 ? t("noSessions") : t("sidebarNoResults")}
              </div>
            ) : (
              groups.map((group, gi) => (
                <div key={group.key} role="group" aria-label={group.label}>
                  <div className={`section-header pb-1 ${gi === 0 ? "pt-1" : "pt-3"}`}>{group.label}</div>
                  {group.sessions.map((s) => (
                    <SidebarRow
                      key={s.id}
                      session={s}
                      locale={locale}
                      showDate={!group.recent}
                      selected={multiActive ? multiIds.has(s.id) : selectedSessionId === s.id}
                      recording={currentSessionId === s.id}
                      disabled={isListening && currentSessionId !== s.id}
                      onClick={(e) => handleRowClick(e, s)}
                      onContextMenu={(e) => handleRowContextMenu(e, s)}
                    />
                  ))}
                </div>
              ))
            )}
          </div>

          {/* Multi-selection bar */}
          {showBulkBar && (
            <div className="shrink-0 border-t border-separator px-2 py-2 flex items-center gap-1">
              <span className="flex-1 min-w-0 truncate text-[11px] text-label-2">
                {t("sidebarNSelected", { count: multiIds.size })}
              </span>
              <button className="btn px-2.5" onClick={() => setExportIds([...multiIds])}>
                {t("export")}
              </button>
              <button
                className="btn px-2.5"
                disabled={![...multiIds].some((id) => id !== currentSessionId)}
                onClick={() => requestBulkDelete(multiIds)}
              >
                {t("delete")}
              </button>
              <button className="btn px-2.5" onClick={clearMulti}>
                {t("cancel")}
              </button>
            </div>
          )}
        </div>
        </div>
      </aside>

      <ConfirmDialog
        open={!!confirmDelete}
        title={confirmDelete === "bulk" ? t("deleteSessions") : t("deleteSession")}
        message={confirmDelete === "bulk"
          ? t("deleteSessionsConfirm", { count: multiIds.size })
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
        onExported={clearMulti}
      />

      <PromptDialog
        open={!!renameTarget}
        title={t("renameSession")}
        defaultValue={renameTarget?.title || ""}
        onCancel={() => setRenameTarget(null)}
        onConfirm={handleRename}
      />
    </>
  );
}
