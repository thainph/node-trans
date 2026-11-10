import { Pencil } from "lucide-react";
import { getSpeakerIndex } from "../../utils/speakerColors";
import { useI18n } from "../../i18n/I18nContext";

export default function SpeakerList({ speakers, aliases, speakerColorMap, onRenameSpeaker }) {
  const { t } = useI18n();
  if (speakers.length === 0) return null;

  const speakerName = (s) => {
    const idx = getSpeakerIndex(s, speakerColorMap);
    return aliases[s] || `${t("speaker")} ${idx + 1}`;
  };

  return (
    <>
      {speakers.map((s) => {
        const idx = getSpeakerIndex(s, speakerColorMap);
        const name = speakerName(s);
        return (
          <div key={s} className={`speaker-${idx} group flex items-center gap-1.5 h-6 pl-2 pr-0.5 rounded-full bg-fill`}>
            <span className="w-2 h-2 rounded-full shrink-0 bg-(--speaker-color)" />
            <span className="text-[12px] text-label">{name}</span>
            <button
              className="btn-icon min-w-5! h-5! px-0! rounded-full! opacity-60 group-hover:opacity-100"
              onClick={() => onRenameSpeaker(s, name)}
              title={t("renameSpeaker", { name })}
              aria-label={t("renameSpeaker", { name })}
            >
              <Pencil size={12} strokeWidth={1.75} />
            </button>
          </div>
        );
      })}
    </>
  );
}
