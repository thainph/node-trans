import { useState } from "react";
import { PanelLeft, PictureInPicture2, Settings, Circle, Square, Pause, Play, SquarePen, Ellipsis, FilePlus2 } from "lucide-react";
import { useI18n } from "../i18n/I18nContext";
import { useSocketActions, useSession, useTranscript, useUI } from "../context/SocketContext";
import { useCommand, shortcutLabel } from "../hooks/useCommand";
import { useRecording, formatDuration } from "../hooks/useRecording";
import { showContextMenu } from "../utils/contextMenu";
import { deleteSession, renameSession } from "../utils/api";
import { ConfirmDialog, PromptDialog } from "./Modal";
import ExportDialog from "./live/ExportDialog";

const ICON = { size: 16, strokeWidth: 1.75 };

function sessionTitle(d) {
  return d?.title || new Date(d?.started_at + "Z").toLocaleString("en-US");
}

function withShortcut(label, id) {
  const s = shortcutLabel(id);
  return s ? `${label} (${s})` : label;
}

// Unified title bar + toolbar. The whole bar is a window drag region in Electron;
// buttons opt out via the .drag rule in style.css.
export default function Toolbar({ sidebarOpen, onToggleSidebar, onOpenSettings }) {
  const { t } = useI18n();
  const { dispatch } = useSocketActions();
  const { isListening, isPaused, pendingAction, selectedSessionId, selectedSessionData } = useSession();
  const { utterances, partialResults } = useTranscript();
  const { overlayVisible, overlaySettings } = useUI();
  const { elapsed, toggle, pauseResume, newMeeting } = useRecording();

  const [renameModal, setRenameModal] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  const canEditSession = !!selectedSessionId && !isListening;

  const toggleOverlay = () => {
    window.electronAPI?.toggleOverlay?.({
      settings: overlaySettings,
      utterances: utterances.slice(-overlaySettings.maxLines),
      partials: partialResults,
    });
    dispatch({ type: "TOGGLE_OVERLAY" });
  };

  const openRename = () => setRenameModal({ value: sessionTitle(selectedSessionData) });

  useCommand("toggle-overlay", toggleOverlay);
  useCommand("toggle-recording", toggle);
  useCommand("pause-resume", pauseResume);
  useCommand("new-session", () => {
    if (!isListening) dispatch({ type: "DESELECT_SESSION" });
  });
  useCommand("rename", () => canEditSession && openRename());
  useCommand("export", () => canEditSession && setExportOpen(true));
  useCommand("delete", () => canEditSession && setConfirmDelete(true));

  const openMoreMenu = async (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const id = await showContextMenu({ clientX: rect.left, clientY: rect.bottom + 4 }, [
      { id: "rename", label: t("menuRename") },
      { id: "export", label: t("menuExport") },
      { type: "separator" },
      { id: "delete", label: t("menuDelete") },
    ]);
    if (id === "rename") openRename();
    else if (id === "export") setExportOpen(true);
    else if (id === "delete") setConfirmDelete(true);
  };

  // Title block
  let title, subtitle;
  if (isListening) {
    title = t("liveSession");
    subtitle = isPaused ? t("paused") : t("recordingNow");
  } else if (selectedSessionData) {
    title = sessionTitle(selectedSessionData);
    subtitle = new Date(selectedSessionData.started_at + "Z").toLocaleString("en-US", {
      weekday: "short", month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit",
    });
  } else {
    title = t("newSession");
    subtitle = t("readyToRecord");
  }

  const recordLabel = isListening ? t("stop") : selectedSessionId ? t("resume") : t("start");

  return (
    <>
      {/* Scroll-edge effect: content fades and blurs as it slides under the floating toolbar */}
      <div className="scroll-edge-top absolute inset-x-0 top-0 h-[72px] z-10 pointer-events-none" aria-hidden="true" />

      <header className={`drag absolute inset-x-0 top-0 z-20 h-[52px] flex items-center gap-2 px-3 ${sidebarOpen ? "" : "traffic-light-pad"}`}>
        <div className="glass-capsule">
          <button
            className="btn-icon"
            onClick={onToggleSidebar}
            title={withShortcut(sidebarOpen ? t("hideSessions") : t("showSessions"), "toggle-sidebar")}
            aria-label={sidebarOpen ? t("hideSessions") : t("showSessions")}
          >
            <PanelLeft {...ICON} />
          </button>
        </div>

        <div className="flex-1 min-w-0 flex flex-col justify-center px-1.5">
          <div className="text-[15px] font-semibold text-label truncate leading-tight" title={title}>{title}</div>
          <div className="text-[11px] text-label-2 truncate leading-tight mt-0.5 flex items-center gap-1.5">
            {isListening && (
              <span
                className={`w-1.5 h-1.5 rounded-full shrink-0 ${isPaused ? "bg-sys-orange" : "bg-sys-red animate-[recording-pulse_1.6s_ease-in-out_infinite]"}`}
              />
            )}
            {subtitle}
          </div>
        </div>

        {isListening && (
          <div className="glass-capsule">
            <span className="font-mono tabular-nums text-label text-[13px] pl-3 pr-1" aria-label={t("elapsed")}>
              {formatDuration(elapsed)}
            </span>
            <button
              className="btn-icon"
              disabled={pendingAction}
              onClick={pauseResume}
              title={withShortcut(isPaused ? t("resume") : t("pause"), "pause-resume")}
              aria-label={isPaused ? t("resume") : t("pause")}
            >
              {isPaused ? <Play {...ICON} /> : <Pause {...ICON} />}
            </button>
            {isPaused && (
              <button
                className="btn-icon"
                disabled={pendingAction}
                onClick={newMeeting}
                title={t("newMeeting")}
                aria-label={t("newMeeting")}
              >
                <FilePlus2 {...ICON} />
              </button>
            )}
          </div>
        )}

        {canEditSession && (
          <div className="glass-capsule">
            <button
              className="btn-icon"
              onClick={() => dispatch({ type: "DESELECT_SESSION" })}
              title={withShortcut(t("newSession"), "new-session")}
              aria-label={t("newSession")}
            >
              <SquarePen {...ICON} />
            </button>
            <button
              className="btn-icon"
              onClick={openMoreMenu}
              title={t("moreActions")}
              aria-label={t("moreActions")}
              aria-haspopup="menu"
            >
              <Ellipsis {...ICON} />
            </button>
          </div>
        )}

        <button
          className={`btn h-9 px-4 ${isListening ? "btn-destructive" : "btn-glass"}`}
          disabled={pendingAction}
          aria-busy={pendingAction || undefined}
          onClick={toggle}
          title={withShortcut(recordLabel, "toggle-recording")}
        >
          {isListening
            ? <Square size={11} strokeWidth={0} fill="currentColor" />
            : <Circle size={11} strokeWidth={0} fill="currentColor" className="text-sys-red" />}
          {recordLabel}
        </button>

        <div className="glass-capsule">
          <button
            className="btn-icon"
            aria-pressed={overlayVisible}
            onClick={toggleOverlay}
            title={withShortcut(t("overlay"), "toggle-overlay")}
            aria-label={t("overlay")}
          >
            <PictureInPicture2 {...ICON} />
          </button>
          <button
            className="btn-icon"
            onClick={onOpenSettings}
            title={withShortcut(t("tabSettings"), "settings")}
            aria-label={t("tabSettings")}
          >
            <Settings {...ICON} />
          </button>
        </div>
      </header>

      {/* Dialogs live outside the drag region so their backdrops stay clickable in Electron */}
      <ConfirmDialog
        open={confirmDelete}
        title={t("deleteSession")}
        message={t("deleteSessionConfirm")}
        confirmLabel={t("delete")}
        confirmColor="red"
        onConfirm={async () => {
          const id = selectedSessionId;
          setConfirmDelete(false);
          await deleteSession(id);
          dispatch({ type: "DESELECT_SESSION" });
          dispatch({ type: "REFRESH_SESSION_LIST" });
        }}
        onCancel={() => setConfirmDelete(false)}
      />

      <ExportDialog open={exportOpen} sessionIds={[selectedSessionId]} onClose={() => setExportOpen(false)} />

      <PromptDialog
        open={!!renameModal}
        title={t("renameSession")}
        defaultValue={renameModal?.value || ""}
        onCancel={() => setRenameModal(null)}
        onConfirm={async (newTitle) => {
          setRenameModal(null);
          await renameSession(selectedSessionId, newTitle);
          dispatch({ type: "UPDATE_SESSION_DATA", payload: { title: newTitle } });
          dispatch({ type: "REFRESH_SESSION_LIST" });
        }}
      />
    </>
  );
}
