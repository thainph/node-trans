import { memo } from "react";
import { getSpeakerIndex } from "../../utils/speakerColors";
import { useI18n } from "../../i18n/I18nContext";

// One transcript entry. Consecutive entries from the same speaker are `grouped`
// and drop the speaker line so the transcript reads like continuous paragraphs.
function Utterance({ data, grouped, speakerColorMap, speakerName }) {
  const { t } = useI18n();
  const idx = getSpeakerIndex(data.speaker, speakerColorMap);
  const speaker = speakerName || (data.speaker ? `${t("speaker")} ${idx + 1}` : t("speaker"));
  const time = new Date(data.timestamp).toLocaleTimeString("en-US");
  const lang = data.originalLanguage || data.original_language;
  const source = data.source;
  const original = data.originalText || data.original_text;
  const translation = data.translatedText || data.translated_text;

  return (
    <div className={`speaker-${idx} ${grouped ? "mt-2.5" : "mt-5 first:mt-0"}`}>
      {!grouped && (
        <div className="flex items-center gap-1.5 mb-1 text-[12px]">
          <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-(--speaker-color)" />
          <span className="font-semibold text-(--speaker-color)">{speaker}</span>
          <span className="text-[11px] text-label-3 tabular-nums">{time}</span>
          {lang && <span className="text-[11px] text-label-3 uppercase">{lang}</span>}
          {source && source !== "mic" && <span className="text-[11px] text-label-3 uppercase">{source}</span>}
        </div>
      )}
      <div className="selectable text-[14px] leading-relaxed text-label-2" title={grouped ? time : undefined}>{original}</div>
      {translation && (
        <div className="selectable text-[14px] leading-relaxed text-label mt-0.5">{translation}</div>
      )}
    </div>
  );
}

export default memo(Utterance, (prev, next) =>
  prev.data === next.data && prev.speakerName === next.speakerName && prev.grouped === next.grouped
);
