import { getSpeakerIndex } from "../../utils/speakerColors";
import { useI18n } from "../../i18n/I18nContext";

export default function Utterance({ data, speakerColorMap, speakerName }) {
  const { t } = useI18n();
  const idx = getSpeakerIndex(data.speaker, speakerColorMap);
  const speaker = speakerName || (data.speaker ? `${t("speaker")} ${data.speaker}` : t("speaker"));
  const time = new Date(data.timestamp).toLocaleTimeString("en-US");
  const lang = data.originalLanguage || data.original_language;
  const source = data.source;
  const original = data.originalText || data.original_text;
  const translation = data.translatedText || data.translated_text;

  return (
    <div className={`speaker-${idx} p-3 mb-1.5 rounded-xl bg-gray-50/80 dark:bg-white/3 border-l-3 border-l-(--speaker-color,#444) transition-all duration-200 hover:bg-gray-100/80 dark:hover:bg-white/6 shadow-sm hover:shadow-md`}>
      <div className="flex items-center gap-2 mb-1.5 text-xs">
        <span className="font-bold text-(--speaker-color,#60a5fa)">{speaker}</span>
        {lang && (
          <span className="bg-gray-100/80 dark:bg-white/5 text-gray-500 dark:text-gray-500 px-2 py-px rounded-full text-[0.68rem] font-medium">
            {lang}
          </span>
        )}
        {source && source !== "mic" && (
          <span className="bg-gray-100/80 dark:bg-white/5 text-gray-400 dark:text-gray-600 px-2 py-px rounded-full text-[0.68rem] font-medium">
            {source.toUpperCase()}
          </span>
        )}
        <span className="ml-auto text-gray-300 dark:text-gray-700 text-[0.7rem] tabular-nums">{time}</span>
      </div>
      <div className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed mb-1">{original}</div>
      {translation && (
        <div className="text-sm text-(--speaker-color,#4ade80) opacity-85 leading-relaxed pl-3 border-l-2 border-l-(--speaker-color,#4ade80) mt-1">
          {translation}
        </div>
      )}
    </div>
  );
}
