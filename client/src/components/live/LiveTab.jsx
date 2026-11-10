import { useMemo, useState, useRef, useEffect } from "react";
import { useSocketActions, useSession, useTranscript } from "../../context/SocketContext";
import { useI18n } from "../../i18n/I18nContext";
import { setSpeakerAlias } from "../../utils/api";
import { SOURCE_LABELS_FULL, LANG_LABELS_FULL, CONTEXT_PRESETS } from "../../utils/constants";
import { PromptDialog } from "../Modal";
import SpeakerList from "../history/SpeakerList";
import Controls from "./Controls";
import StatusBar from "../StatusBar";
import Transcript from "./Transcript";

const Dot = () => <span className="text-label-3" aria-hidden="true">·</span>;

export default function LiveTab() {
  const { dispatch } = useSocketActions();
  const { selectedSessionData, selectedSessionId, isListening } = useSession();
  const { utterances, speakerColorMap, partialResults } = useTranscript();
  const { t } = useI18n();
  const [speakerModal, setSpeakerModal] = useState(null);

  // Track the floating bar's height so the transcript can scroll clear of it
  const barRef = useRef(null);
  const [barHeight, setBarHeight] = useState(48);
  useEffect(() => {
    const el = barRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setBarHeight(el.offsetHeight + 12));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const sessionInfo = useMemo(() => {
    if (!selectedSessionData || isListening) return null;
    const d = selectedSessionData;
    const startDate = new Date(d.started_at + "Z");
    const endDate = d.ended_at ? new Date(d.ended_at + "Z") : null;
    let duration = t("inProgress");
    if (endDate) {
      const diffMs = endDate - startDate;
      const mins = Math.floor(diffMs / 60000);
      const secs = Math.floor((diffMs % 60000) / 1000);
      duration = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
    }
    const dateStr = startDate.toLocaleString("en-US", {
      month: "short", day: "numeric", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
    const utts = d.utterances || [];
    const speakers = [...new Set(utts.map((u) => u.speaker).filter(Boolean))];
    const contextPreset = d.context
      ? CONTEXT_PRESETS.find((p) => p.value !== "custom" && p.text === d.context)
      : null;
    const contextLabel = contextPreset
      ? t(contextPreset.labelKey)
      : d.context
        ? d.context.length > 50 ? d.context.slice(0, 50) + "…" : d.context
        : null;

    // Handle "both" sources with potentially different targets: "vi,en"
    const targetStr = d.target_language?.includes(",")
      ? d.target_language.split(",").map((l) => LANG_LABELS_FULL[l] || l).join(" / ")
      : (LANG_LABELS_FULL[d.target_language] || d.target_language);
    const sourceStr = SOURCE_LABELS_FULL[d.audio_source] || d.audio_source;

    return { dateStr, duration, sourceStr, targetStr, contextLabel, uttCount: utts.length, speakers, aliases: d.speakerAliases || {} };
  }, [selectedSessionData, isListening, t]);

  const header = sessionInfo && (
    <div className="pb-3 mb-4 border-b border-separator">
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[12px] text-label-2">
        <span>{sessionInfo.dateStr}</span>
        <Dot />
        <span className="tabular-nums">{sessionInfo.duration}</span>
        <Dot />
        <span>{sessionInfo.sourceStr} → {sessionInfo.targetStr}</span>
        {sessionInfo.contextLabel && <>
          <Dot />
          <span className="truncate max-w-[240px]" title={selectedSessionData?.context}>{sessionInfo.contextLabel}</span>
        </>}
        <Dot />
        <span className="tabular-nums">{t("utteranceCount", { count: sessionInfo.uttCount })}</span>
      </div>

      {sessionInfo.speakers.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          <SpeakerList
            speakers={sessionInfo.speakers}
            aliases={sessionInfo.aliases}
            speakerColorMap={speakerColorMap}
            onRenameSpeaker={(speaker, currentName) => setSpeakerModal({ speaker, currentName })}
          />
        </div>
      )}
    </div>
  );

  return (
    <div className="absolute inset-0 flex flex-col">
      <Transcript
        header={header}
        utterances={utterances}
        speakerColorMap={speakerColorMap}
        speakerAliases={selectedSessionData?.speakerAliases}
        partialResults={partialResults}
        bottomInset={barHeight + 12}
      />

      {/* Floating glass bottom bar: status + session setup */}
      <div className="absolute inset-x-0 bottom-0 z-10 p-3 flex justify-center pointer-events-none">
        <div ref={barRef} className="glass-panel rounded-[22px] pointer-events-auto max-w-full flex items-center gap-x-4 px-3 py-2">
          <StatusBar />
          <Controls />
        </div>
      </div>

      <PromptDialog
        open={!!speakerModal}
        title={t("renameSpeaker", { name: speakerModal?.currentName || "" })}
        defaultValue={speakerModal?.currentName || ""}
        onCancel={() => setSpeakerModal(null)}
        onConfirm={async (newName) => {
          const { speaker, currentName } = speakerModal;
          setSpeakerModal(null);
          if (newName !== currentName) {
            await setSpeakerAlias(selectedSessionId, speaker, newName);
            dispatch({
              type: "SELECT_SESSION",
              payload: {
                sessionId: selectedSessionId,
                sessionData: {
                  ...selectedSessionData,
                  speakerAliases: { ...selectedSessionData.speakerAliases, [speaker]: newName },
                },
                utterances,
              },
            });
          }
        }}
      />
    </div>
  );
}
