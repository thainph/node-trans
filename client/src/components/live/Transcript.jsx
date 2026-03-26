import { useRef, useEffect } from "react";
import { useSocket } from "../../context/SocketContext";
import Utterance from "./Utterance";

export default function Transcript({ utterances, speakerColorMap, speakerAliases }) {
  const { state } = useSocket();
  const ref = useRef(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.scrollTop = ref.current.scrollHeight;
    }
  }, [utterances.length]);

  return (
    <div
      className="flex-1 overflow-y-auto p-4 bg-white/60 dark:bg-[#0b0d18]/60 backdrop-blur-md rounded-2xl border border-gray-200/50 dark:border-indigo-500/10 mt-2 shadow-sm"
      ref={ref}
    >
      {utterances.length === 0 ? (
        <div className="text-gray-300 dark:text-gray-700 text-center py-15 text-sm">
          {state.selectedSessionId
            ? 'Press "Resume" to continue this session'
            : 'Press "Start" to listen and translate audio'}
        </div>
      ) : (
        utterances.map((u, i) => (
          <Utterance
            key={i}
            data={u}
            speakerColorMap={speakerColorMap}
            speakerName={u.speaker && speakerAliases?.[u.speaker] ? speakerAliases[u.speaker] : undefined}
          />
        ))
      )}
    </div>
  );
}
