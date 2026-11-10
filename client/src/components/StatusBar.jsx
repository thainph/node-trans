import { useSession, useTranscript, useUI } from "../context/SocketContext";
import { useI18n } from "../i18n/I18nContext";

const DOT = {
  listening: "bg-sys-green animate-[recording-pulse_1.6s_ease-in-out_infinite]",
  paused: "bg-sys-orange",
  error: "bg-sys-red",
  "": "bg-label-3",
};

// Status readout inside the floating bottom bar: connection / recording state + transcript count.
export default function StatusBar() {
  const { statusKey, statusParams, statusClass } = useUI();
  const { isListening, selectedSessionId } = useSession();
  const { utterances } = useTranscript();
  const { t } = useI18n();

  const text = statusKey ? t(statusKey, statusParams) : "";
  const showCount = (isListening || selectedSessionId) && utterances.length > 0;
  // Next to the full session-setup controls only the dot fits; the text moves to the tooltip
  const compact = !isListening && !selectedSessionId;

  if (compact) {
    return (
      <div className="h-7 flex items-center pl-1" title={text}>
        <span className={`w-2 h-2 rounded-full shrink-0 ${DOT[statusClass] || DOT[""]}`} aria-hidden="true" />
        <span className="sr-only" role="status">{text}</span>
      </div>
    );
  }

  return (
    <div className="h-7 flex items-center gap-2 pl-1 text-[12px] text-label-2 min-w-0">
      <span className={`w-2 h-2 rounded-full shrink-0 ${DOT[statusClass] || DOT[""]}`} aria-hidden="true" />
      <span className="truncate" role="status">{text}</span>
      {showCount && <>
        <span className="text-label-3" aria-hidden="true">·</span>
        <span className="tabular-nums whitespace-nowrap">{t("utteranceCount", { count: utterances.length })}</span>
      </>}
    </div>
  );
}
