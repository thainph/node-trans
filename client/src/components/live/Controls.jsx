import { useState, useEffect, useRef, useCallback, memo } from "react";
import { useSocketActions, useSession, useUI } from "../../context/SocketContext";
import { useI18n } from "../../i18n/I18nContext";
import { deleteSession, renameSession, fetchSettings, saveSettings } from "../../utils/api";
import { CONTEXT_PRESETS, LANGUAGE_OPTIONS } from "../../utils/constants";
import { ConfirmDialog, PromptDialog } from "../Modal";
import ExportDialog from "./ExportDialog";

const btnBase = "px-5 py-2 rounded-xl text-sm font-semibold transition-all duration-200 cursor-pointer border-none whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 text-white";
const btnAction = "bg-transparent border-none cursor-pointer text-sm px-2 py-1 rounded-lg transition-all duration-200 hover:bg-gray-100/60 dark:hover:bg-white/5 active:scale-95 text-gray-500 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300";
const sCls = "bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-gray-600 px-2 py-1.5 rounded-lg text-xs outline-none cursor-pointer hover:border-indigo-400 dark:hover:border-indigo-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-colors w-full";
const arrowCls = "text-gray-300 dark:text-gray-600 text-xs text-center";

const LangRow = memo(function LangRow({ sourceVal, onSource, targetVal, onTarget, disabled }) {
  return (
    <>
      <select className={sCls} value={sourceVal} onChange={onSource} disabled={disabled}>
        <option value="auto">Auto</option>
        {LANGUAGE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <span className={arrowCls}>→</span>
      <select className={sCls} value={targetVal} onChange={onTarget} disabled={disabled}>
        {LANGUAGE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </>
  );
});

function formatDuration(ms) {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

export default function Controls() {
  const { socket, dispatch } = useSocketActions();
  const { isListening, isPaused, pendingAction, selectedSessionId, selectedSessionData } = useSession();
  const { listeningSince, pausedElapsed } = useUI();
  const { t } = useI18n();

  const [elapsed, setElapsed] = useState(0);
  const [renameModal, setRenameModal] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [contextPreset, setContextPreset] = useState("none");
  const [customContext, setCustomContext] = useState("");
  const [audioSource, setAudioSource] = useState("mic");
  const [micSourceLang, setMicSourceLang] = useState("auto");
  const [micTargetLang, setMicTargetLang] = useState("vi");
  const [sysSourceLang, setSysSourceLang] = useState("auto");
  const [sysTargetLang, setSysTargetLang] = useState("vi");
  const defaultCtx = useRef({ preset: "none", custom: "" });
  const settingsRef = useRef({});

  useEffect(() => {
    fetchSettings()
      .then((s) => {
        settingsRef.current = s;
        defaultCtx.current = {
          preset: s.defaultContext || "none",
          custom: s.defaultCustomContext || "",
        };
        const defTarget = s.targetLanguage || "vi";
        setAudioSource(s.audioSource || "mic");
        setMicSourceLang(s.micWhisperLanguage || "auto");
        setMicTargetLang(s.micTargetLanguage || defTarget);
        setSysSourceLang(s.systemWhisperLanguage || "auto");
        setSysTargetLang(s.systemTargetLanguage || defTarget);
        if (!selectedSessionId) {
          setContextPreset(defaultCtx.current.preset);
          setCustomContext(defaultCtx.current.custom);
        }
      })
      .catch(() => {});
  }, []);

  const quickSave = (patch) => {
    Object.assign(settingsRef.current, patch);
    saveSettings(patch).catch(() => {});
  };

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

  useEffect(() => {
    const selected = selectedSessionData;
    if (selected && selected.context) {
      const preset = CONTEXT_PRESETS.find((p) => p.value !== "custom" && p.text === selected.context);
      if (preset) {
        setContextPreset(preset.value);
        setCustomContext("");
      } else {
        setContextPreset("custom");
        setCustomContext(selected.context);
      }
    } else {
      setContextPreset(defaultCtx.current.preset);
      setCustomContext(defaultCtx.current.custom);
    }
  }, [selectedSessionId, selectedSessionData]);

  const activeContext = useCallback(() => {
    if (contextPreset === "custom") {
      return customContext.trim() || null;
    }
    const preset = CONTEXT_PRESETS.find((p) => p.value === contextPreset);
    return preset && preset.text ? preset.text : null;
  }, [contextPreset, customContext]);

  const emit = useCallback((event, payload = {}) => {
    if (pendingAction) return;
    dispatch({ type: "SET_PENDING" });
    socket.emit(event, payload);
  }, [pendingAction, dispatch, socket]);

  const handleToggle = useCallback(() => {
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
  }, [pendingAction, isListening, selectedSessionId, dispatch, socket, activeContext]);

  const handleNewMeeting = useCallback(() => {
    if (pendingAction) return;
    dispatch({ type: "SET_PENDING" });
    const context = activeContext();
    dispatch({ type: "SET_CONTEXT", payload: context });
    socket.emit("stop-listening");
    dispatch({ type: "CLEAR_TRANSCRIPT" });
    setTimeout(() => socket.emit("start-listening", { context }), 200);
  }, [pendingAction, dispatch, socket, activeContext]);

  const loadingCls = pendingAction ? " btn-loading" : "";
  const lCls = "text-[10px] text-gray-400 dark:text-gray-600 uppercase tracking-wider font-medium whitespace-nowrap";

  return (
    <>
      <div className={`mb-2 py-2.5 px-3 bg-white/50 dark:bg-white/3 border border-gray-200/50 dark:border-indigo-500/10 rounded-xl transition-opacity${isListening ? " opacity-50 pointer-events-none" : ""}`}>
        <div className="grid gap-x-2 gap-y-1.5 items-center" style={{ gridTemplateColumns: "auto 1fr auto 1fr" }}>

          {/* Mic row */}
          {audioSource !== "system" && <>
            <span className={lCls}>Mic</span>
            <LangRow disabled={isListening}
              sourceVal={micSourceLang} onSource={(e) => { setMicSourceLang(e.target.value); quickSave({ micWhisperLanguage: e.target.value }); }}
              targetVal={micTargetLang}  onTarget={(e) => { setMicTargetLang(e.target.value); quickSave({ micTargetLanguage: e.target.value, targetLanguage: e.target.value }); }}
            />
          </>}

          {/* Sys row */}
          {audioSource !== "mic" && <>
            <span className={lCls}>Sys</span>
            <LangRow disabled={isListening}
              sourceVal={sysSourceLang} onSource={(e) => { setSysSourceLang(e.target.value); quickSave({ systemWhisperLanguage: e.target.value }); }}
              targetVal={sysTargetLang}  onTarget={(e) => { setSysTargetLang(e.target.value); quickSave({ systemTargetLanguage: e.target.value }); }}
            />
          </>}

          {/* Divider */}
          <div className="col-span-4 border-t border-gray-100/60 dark:border-indigo-500/10 -mb-0.5" />

          {/* Context row */}
          <span className={lCls}>{t("context")}</span>
          <div className="col-span-3 flex gap-2">
            <select className={`${sCls} flex-1`} value={contextPreset} onChange={(e) => setContextPreset(e.target.value)} disabled={isListening}>
              {CONTEXT_PRESETS.map((opt) => <option key={opt.value} value={opt.value}>{t(opt.labelKey)}</option>)}
            </select>
            {contextPreset === "custom" && (
              <input className={`${sCls} flex-[2]`} placeholder={t("contextPlaceholder")}
                value={customContext} onChange={(e) => setCustomContext(e.target.value)} disabled={isListening} />
            )}
          </div>

        </div>
      </div>
      <div className="py-2.5 flex items-center gap-3 flex-wrap">
      <button
        className={`${btnBase} ${isListening ? "bg-linear-to-r from-rose-600 to-pink-500 shadow-lg shadow-rose-500/25 hover:shadow-xl hover:shadow-rose-500/30" : "bg-linear-to-r from-indigo-600 to-cyan-500 shadow-lg shadow-indigo-500/25 hover:shadow-xl hover:shadow-indigo-500/30"}${loadingCls}`}
        disabled={pendingAction}
        onClick={handleToggle}
      >
        {isListening ? `⏹ ${t("stop")}` : selectedSessionId ? `▶ ${t("resume")}` : `▶ ${t("start")}`}
      </button>

      {!isListening && selectedSessionId && (
        <>
          <button
            className={`${btnBase} text-gray-700! dark:text-gray-300! bg-gray-100/80 dark:bg-white/5 border border-gray-200/60 dark:border-indigo-500/10 hover:bg-gray-200/80 dark:hover:bg-white/10`}
            onClick={() => dispatch({ type: "DESELECT_SESSION" })}
          >
            ⊕ {t("newSession")}
          </button>
          <div className="flex items-center gap-0.5 ml-auto">
            <button className={btnAction} title={t("rename")} onClick={() => {
              const d = selectedSessionData;
              const title = d?.title || new Date(d?.started_at + "Z").toLocaleString("en-US");
              setRenameModal({ value: title });
            }}>
              🖊️
            </button>
            <button className={btnAction} title={t("export")} onClick={() => setExportOpen(true)}>
              📥
            </button>
            <button className={`${btnAction} hover:text-red-500! dark:hover:text-red-400!`} title={t("delete")} onClick={() => setConfirmDelete(true)}>
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
          ⏸ {t("pause")}
        </button>
      )}

      {isListening && isPaused && (
        <>
          <button
            className={`${btnBase} bg-linear-to-r from-emerald-500 to-teal-500 shadow-lg shadow-emerald-500/25 hover:shadow-xl hover:shadow-emerald-500/30${loadingCls}`}
            disabled={pendingAction}
            onClick={() => emit("resume-listening")}
          >
            ▶ {t("resume")}
          </button>
          <button
            className={`${btnBase} text-gray-700! dark:text-gray-300! bg-gray-100/80 dark:bg-white/5 border border-gray-200/60 dark:border-indigo-500/10 hover:bg-gray-200/80 dark:hover:bg-white/10${loadingCls}`}
            disabled={pendingAction}
            onClick={handleNewMeeting}
          >
            ⊕ {t("newMeeting")}
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
    </div>
  </>
  );
}
