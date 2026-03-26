import { useMemo, useState } from "react";
import { useSocket } from "../../context/SocketContext";
import { setSpeakerAlias } from "../../utils/api";
import { SOURCE_LABELS_FULL, LANG_LABELS_FULL } from "../../utils/constants";
import { PromptDialog } from "../Modal";
import SpeakerList from "../history/SpeakerList";
import Controls from "./Controls";
import Transcript from "./Transcript";
import PartialResult from "./PartialResult";

export default function LiveTab() {
  const { state, dispatch } = useSocket();
  const { selectedSessionData, selectedSessionId, utterances, speakerColorMap, isListening } = state;
  const [speakerModal, setSpeakerModal] = useState(null);

  const sessionInfo = useMemo(() => {
    if (!selectedSessionData || isListening) return null;
    const d = selectedSessionData;
    const startDate = new Date(d.started_at + "Z");
    const endDate = d.ended_at ? new Date(d.ended_at + "Z") : null;
    let durationText = "In progress";
    if (endDate) {
      const diffMs = endDate - startDate;
      const mins = Math.floor(diffMs / 60000);
      const secs = Math.floor((diffMs % 60000) / 1000);
      durationText = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
    }
    const utts = d.utterances || [];
    const speakers = [...new Set(utts.map((u) => u.speaker).filter(Boolean))];
    const aliases = d.speakerAliases || {};
    return {
      title: d.title || startDate.toLocaleString("en-US"),
      startDate: startDate.toLocaleString("en-US"),
      duration: durationText,
      source: SOURCE_LABELS_FULL[d.audio_source] || d.audio_source,
      target: LANG_LABELS_FULL[d.target_language] || d.target_language,
      uttCount: utts.length,
      speakers,
      aliases,
    };
  }, [selectedSessionData, isListening]);

  const stats = sessionInfo
    ? [
        ["Started", sessionInfo.startDate],
        ["Duration", sessionInfo.duration],
        ["Source", sessionInfo.source],
        ["Target", sessionInfo.target],
        ["Utterances", sessionInfo.uttCount],
        ["Speakers", sessionInfo.speakers.length || "—"],
      ]
    : [];

  return (
    <>
      <Controls />
      {sessionInfo && (
        <div className="p-4 bg-white/60 dark:bg-white/3 backdrop-blur-md border border-gray-200/50 dark:border-indigo-500/10 rounded-2xl text-sm text-gray-600 dark:text-gray-400 shadow-sm mt-2">
          <div className="grid grid-cols-3 gap-y-2 gap-x-6">
            {stats.map(([label, value]) => (
              <div key={label} className="flex justify-between items-center py-1 border-b border-gray-100/60 dark:border-indigo-500/10">
                <span className="text-xs text-gray-400 dark:text-gray-600 font-medium">{label}</span>
                <span className="text-sm text-gray-700 dark:text-gray-300 text-right">{value}</span>
              </div>
            ))}
          </div>
          <SpeakerList
            speakers={sessionInfo.speakers}
            aliases={sessionInfo.aliases}
            speakerColorMap={speakerColorMap}
            onRenameSpeaker={(speaker, currentName) => setSpeakerModal({ speaker, currentName })}
          />
        </div>
      )}
      <Transcript utterances={utterances} speakerColorMap={speakerColorMap} speakerAliases={selectedSessionData?.speakerAliases} />
      <PartialResult data={state.partialResult} />

      <PromptDialog
        open={!!speakerModal}
        title={`Rename ${speakerModal?.currentName || ""}`}
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
    </>
  );
}
