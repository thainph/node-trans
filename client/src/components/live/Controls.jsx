import { useState, useEffect, useRef, memo } from "react";
import { useSession } from "../../context/SocketContext";
import { useI18n } from "../../i18n/I18nContext";
import { fetchSettings, saveSettings } from "../../utils/api";
import { CONTEXT_PRESETS, LANGUAGE_OPTIONS } from "../../utils/constants";
import { useContextDraft } from "../../hooks/useRecording";

const labelCls = "text-[12px] text-label-2 whitespace-nowrap";

const SOURCES = [
  { value: "mic", labelKey: "sourceMic" },
  { value: "system", labelKey: "sourceSystem" },
  { value: "both", labelKey: "sourceBoth" },
];

const LangRow = memo(function LangRow({ label, sourceLabel, targetLabel, sourceVal, onSource, targetVal, onTarget }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={labelCls}>{label}</span>
      <select className="select max-w-[150px]" value={sourceVal} onChange={onSource} aria-label={`${label} ${sourceLabel}`}>
        <option value="auto">Auto</option>
        {LANGUAGE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <span className="text-label-3 text-[12px]" aria-hidden="true">→</span>
      <select className="select max-w-[150px]" value={targetVal} onChange={onTarget} aria-label={`${label} ${targetLabel}`}>
        {LANGUAGE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
});

// Session setup bar: audio source, languages and context for the next recording.
// Only shown for a new session that isn't recording yet — resumed sessions keep their own
// source/languages on the server, and nothing here can change while recording.
export default function Controls() {
  const { isListening, selectedSessionId } = useSession();
  const { t } = useI18n();
  const [{ preset: contextPreset, custom: customContext }, setContextPreset, setCustomContext] = useContextDraft();

  const [audioSource, setAudioSource] = useState("mic");
  const [micSourceLang, setMicSourceLang] = useState("auto");
  const [micTargetLang, setMicTargetLang] = useState("vi");
  const [sysSourceLang, setSysSourceLang] = useState("auto");
  const [sysTargetLang, setSysTargetLang] = useState("vi");
  const settingsRef = useRef({});

  useEffect(() => {
    fetchSettings()
      .then((s) => {
        settingsRef.current = s;
        const defTarget = s.targetLanguage || "vi";
        setAudioSource(s.audioSource || "mic");
        setMicSourceLang(s.micWhisperLanguage || "auto");
        setMicTargetLang(s.micTargetLanguage || defTarget);
        setSysSourceLang(s.systemWhisperLanguage || "auto");
        setSysTargetLang(s.systemTargetLanguage || defTarget);
      })
      .catch(() => {});
  }, []);

  const quickSave = (patch) => {
    Object.assign(settingsRef.current, patch);
    saveSettings(patch).catch(() => {});
  };

  if (isListening) return null;
  // Resuming keeps the session's own source/target languages (server side); only the context can change
  const resuming = !!selectedSessionId;

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 min-w-0 border-l border-separator pl-4">
      {!resuming && <div className="flex items-center gap-1.5">
        <span className={labelCls}>{t("source")}</span>
        <div className="segmented" role="group" aria-label={t("source")}>
          {SOURCES.map((s) => (
            <button
              key={s.value}
              type="button"
              aria-pressed={audioSource === s.value}
              onClick={() => { setAudioSource(s.value); quickSave({ audioSource: s.value }); }}
            >
              {t(s.labelKey)}
            </button>
          ))}
        </div>
      </div>}

      {!resuming && audioSource !== "system" && (
        <LangRow
          label={t("sourceMic")} sourceLabel={t("source")} targetLabel={t("target")}
          sourceVal={micSourceLang} onSource={(e) => { setMicSourceLang(e.target.value); quickSave({ micWhisperLanguage: e.target.value }); }}
          targetVal={micTargetLang} onTarget={(e) => { setMicTargetLang(e.target.value); quickSave({ micTargetLanguage: e.target.value, targetLanguage: e.target.value }); }}
        />
      )}

      {!resuming && audioSource !== "mic" && (
        <LangRow
          label={t("sourceSystem")} sourceLabel={t("source")} targetLabel={t("target")}
          sourceVal={sysSourceLang} onSource={(e) => { setSysSourceLang(e.target.value); quickSave({ systemWhisperLanguage: e.target.value }); }}
          targetVal={sysTargetLang} onTarget={(e) => { setSysTargetLang(e.target.value); quickSave({ systemTargetLanguage: e.target.value }); }}
        />
      )}

      <div className="flex items-center gap-1.5 min-w-0 flex-1">
        <span className={labelCls}>{t("context")}</span>
        <select className="select max-w-[180px]" value={contextPreset} onChange={(e) => setContextPreset(e.target.value)} aria-label={t("context")}>
          {CONTEXT_PRESETS.map((opt) => <option key={opt.value} value={opt.value}>{t(opt.labelKey)}</option>)}
        </select>
        {contextPreset === "custom" && (
          <input
            className="field flex-1 min-w-[140px]"
            placeholder={t("contextPlaceholder")}
            value={customContext}
            onChange={(e) => setCustomContext(e.target.value)}
          />
        )}
      </div>
    </div>
  );
}
