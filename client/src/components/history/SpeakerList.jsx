import { getSpeakerIndex } from "../../utils/speakerColors";
import { useI18n } from "../../i18n/I18nContext";

export default function SpeakerList({ speakers, aliases, speakerColorMap, onRenameSpeaker }) {
  const { t } = useI18n();
  if (speakers.length === 0) return null;

  const speakerName = (s) => aliases[s] || `${t("speaker")} ${s}`;

  return (
    <div className="mt-3 pt-2.5 border-t border-gray-100/60 dark:border-indigo-500/10">
      <div className="text-xs text-gray-400 dark:text-gray-600 font-medium mb-2">{t("speakers")}</div>
      {speakers.map((s) => {
        const idx = getSpeakerIndex(s, speakerColorMap);
        return (
          <div key={s} className={`speaker-${idx} flex items-center gap-2 py-1.5`}>
            <span className="w-2.5 h-2.5 rounded-full shrink-0 bg-(--speaker-color,#444) shadow-[0_0_6px_var(--speaker-color)]" />
            <span className="text-sm text-gray-700 dark:text-gray-300 flex-1">{speakerName(s)}</span>
            <button
              className="bg-transparent border-none cursor-pointer text-xs px-1.5 py-0.5 rounded opacity-40 transition-opacity hover:opacity-100 hover:bg-gray-100/60 dark:hover:bg-white/5"
              onClick={() => onRenameSpeaker(s, speakerName(s))}
            >
              🖊️
            </button>
          </div>
        );
      })}
    </div>
  );
}
