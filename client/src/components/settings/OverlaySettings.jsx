import { useSocket } from "../../context/SocketContext";
import { useI18n } from "../../i18n/I18nContext";
import { saveOverlaySettings } from "../../utils/api";

const selectCls = "bg-white/80 dark:bg-white/5 text-gray-700 dark:text-gray-300 border border-gray-200/50 dark:border-indigo-500/10 px-3 py-2 rounded-xl w-full text-sm outline-none transition-all duration-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 hover:border-gray-300 dark:hover:border-indigo-500/20";
const labelCls = "block text-xs text-gray-400 dark:text-gray-600 mb-1.5 font-medium uppercase tracking-wider";
const cardCls = "bg-white/60 dark:bg-white/3 border border-gray-200/50 dark:border-indigo-500/10 rounded-2xl p-5";
const cardTitleCls = "text-xs font-semibold text-gray-500 dark:text-gray-500 uppercase tracking-wider mb-4";

const toggleBtnCls = (active) =>
  `border px-4 py-1.5 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer active:scale-95 ${
    active
      ? "bg-indigo-500/15 dark:bg-indigo-500/20 text-indigo-600 dark:text-cyan-400 border-indigo-500/30"
      : "bg-transparent text-gray-400 dark:text-gray-600 border-gray-200/50 dark:border-indigo-500/10 hover:text-gray-600 dark:hover:text-gray-400"
  }`;

export default function OverlaySettings() {
  const { t } = useI18n();
  const { state, dispatch } = useSocket();
  const s = state.overlaySettings;

  const update = (patch) => {
    dispatch({ type: "UPDATE_OVERLAY_SETTINGS", payload: patch });
    saveOverlaySettings({ ...s, ...patch }).catch(() => {});
  };

  return (
    <div className={cardCls}>
      <p className={cardTitleCls}>{t("overlaySettings")}</p>
      <div className="space-y-4">

        {/* Opacity + Font Scale */}
        <div className="grid grid-cols-2 gap-6">
          <div>
            <label className={labelCls}>
              {t("overlayOpacity")} {Math.round(s.opacity * 100)}%
            </label>
            <input
              type="range" min="0.1" max="1" step="0.05"
              value={s.opacity}
              onChange={(e) => update({ opacity: parseFloat(e.target.value) })}
              className="w-full accent-indigo-500"
            />
          </div>
          <div>
            <label className={labelCls}>
              {t("overlayFontScale")} {Math.round(s.scale * 100)}%
            </label>
            <input
              type="range" min="0.7" max="1.8" step="0.05"
              value={s.scale}
              onChange={(e) => update({ scale: parseFloat(e.target.value) })}
              className="w-full accent-indigo-500"
            />
          </div>
        </div>

        {/* Max Lines */}
        <div className="max-w-xs">
          <label className={labelCls}>
            {t("overlayMaxLines")} {s.maxLines}
          </label>
          <input
            type="range" min="1" max="15" step="1"
            value={s.maxLines}
            onChange={(e) => update({ maxLines: parseInt(e.target.value) })}
            className="w-full accent-indigo-500"
          />
        </div>

        {/* Text Alignment + Background */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>{t("overlayTextAlign")}</label>
            <div className="flex gap-2">
              {["left", "center", "right"].map((align) => (
                <button
                  key={align}
                  className={toggleBtnCls(s.textAlign === align)}
                  onClick={() => update({ textAlign: align })}
                >
                  {t(`overlayAlign${align.charAt(0).toUpperCase() + align.slice(1)}`)}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className={labelCls}>{t("overlayBgColor")}</label>
            <div className="flex gap-2">
              {["dark", "light"].map((bg) => (
                <button
                  key={bg}
                  className={toggleBtnCls(s.bgColor === bg)}
                  onClick={() => update({ bgColor: bg })}
                >
                  {t(`overlayBg${bg.charAt(0).toUpperCase() + bg.slice(1)}`)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Font Family + Display Mode */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>{t("overlayFontFamily")}</label>
            <select
              className={selectCls}
              value={s.fontFamily}
              onChange={(e) => update({ fontFamily: e.target.value })}
            >
              <option value="system-ui, sans-serif">System UI</option>
              <option value="Georgia, serif">Georgia (Serif)</option>
              <option value="'Courier New', monospace">Courier New (Mono)</option>
              <option value="Arial, sans-serif">Arial</option>
              <option value="'Times New Roman', serif">Times New Roman</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>{t("overlayDisplayMode")}</label>
            <select
              className={selectCls}
              value={s.displayMode}
              onChange={(e) => update({ displayMode: e.target.value })}
            >
              <option value="both">{t("overlayModeBoth")}</option>
              <option value="final-only">{t("overlayModeFinal")}</option>
              <option value="partial-only">{t("overlayModePartial")}</option>
            </select>
          </div>
        </div>

      </div>
    </div>
  );
}
