import { useRef, useEffect, useState, memo } from "react";
import { AudioLines, ArrowDown } from "lucide-react";
import { useSession } from "../../context/SocketContext";
import { useI18n } from "../../i18n/I18nContext";
import { getSpeakerIndex } from "../../utils/speakerColors";
import Utterance from "./Utterance";

export default function Transcript({ header, bottomInset = 88, utterances, speakerColorMap, speakerAliases, partialResults }) {
  const { selectedSessionId } = useSession();
  const { t } = useI18n();
  const ref = useRef(null);
  const isAtBottom = useRef(true);
  const [showJumpBtn, setShowJumpBtn] = useState(false);
  const partialEntries = Object.entries(partialResults);
  const hasContent = utterances.length > 0 || partialEntries.some(([, p]) => p.originalText);

  function handleScroll() {
    const el = ref.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    isAtBottom.current = atBottom;
    if (atBottom) setShowJumpBtn(false);
  }

  useEffect(() => {
    if (!ref.current) return;
    if (isAtBottom.current) {
      ref.current.scrollTop = ref.current.scrollHeight;
    } else {
      setShowJumpBtn(true);
    }
  }, [utterances.length, partialResults]);

  function jumpToBottom() {
    if (!ref.current) return;
    ref.current.scrollTop = ref.current.scrollHeight;
    isAtBottom.current = true;
    setShowJumpBtn(false);
  }

  return (
    <div
      className="relative flex-1 overflow-y-auto bg-content"
      ref={ref}
      onScroll={handleScroll}
      // Top/bottom padding keeps text clear of the floating toolbar and bottom bar
      style={{ scrollPaddingBottom: bottomInset }}
    >
      <div
        className={`max-w-[760px] mx-auto px-8 pt-[76px] ${hasContent ? "" : "min-h-full flex flex-col"}`}
        style={{ paddingBottom: bottomInset + 16 }}
      >
        {header}
        {!hasContent ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-2 py-16">
            <AudioLines size={32} strokeWidth={1.5} className="text-label-3 mb-1" />
            <div className="text-[15px] font-semibold text-label">{t("noTranscriptTitle")}</div>
            <div className="text-[13px] text-label-2 max-w-[320px]">
              {selectedSessionId ? t("pressResume") : t("pressStart")}
            </div>
          </div>
        ) : (
          <>
            {utterances.map((u, i) => {
              const prev = utterances[i - 1];
              const grouped = !!prev && prev.speaker === u.speaker && prev.source === u.source;
              return (
                <Utterance
                  key={u._clientId || u.id || i}
                  data={u}
                  grouped={grouped}
                  speakerColorMap={speakerColorMap}
                  speakerName={u.speaker && speakerAliases?.[u.speaker] ? speakerAliases[u.speaker] : undefined}
                />
              );
            })}
            {partialEntries.map(([source, data]) =>
              data.originalText ? (
                <PartialUtterance key={source} data={data} speakerColorMap={speakerColorMap} />
              ) : null
            )}
          </>
        )}
      </div>
      {showJumpBtn && (
        <div className="sticky flex justify-center pointer-events-none" style={{ bottom: bottomInset + 8 }}>
          <button onClick={jumpToBottom} className="btn btn-glass pointer-events-auto">
            <ArrowDown size={14} strokeWidth={1.75} />
            {t("newMessages")}
          </button>
        </div>
      )}
    </div>
  );
}

const PartialUtterance = memo(function PartialUtterance({ data, speakerColorMap }) {
  const { t } = useI18n();
  const idx = getSpeakerIndex(data.speaker, speakerColorMap);
  const speaker = data.speaker ? `${t("speaker")} ${idx + 1}` : t("speaker");

  return (
    <div className={`speaker-${idx} mt-4`}>
      <div className="flex items-center gap-1.5 mb-1 text-[12px]">
        <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-(--speaker-color)" />
        <span className="font-semibold text-(--speaker-color)">{speaker}</span>
        {data.source && data.source !== "mic" && (
          <span className="text-[11px] text-label-3 uppercase">{data.source}</span>
        )}
      </div>
      <div className="selectable text-[14px] leading-relaxed italic text-label-3">{data.originalText}</div>
      {data.translatedText && (
        <div className="selectable text-[14px] leading-relaxed italic text-label-3 mt-0.5">{data.translatedText}</div>
      )}
    </div>
  );
});
