import { useSocketActions, useUI } from "../../context/SocketContext";
import { useI18n } from "../../i18n/I18nContext";
import { saveOverlaySettings } from "../../utils/api";
import { reportError } from "../../utils/errors";

// Locale labels end with ":" for the old stacked layout; rows don't need it
const strip = (str) => str.replace(/:\s*$/, "");

function Slider({ value, min, max, step, onChange, display }) {
  return (
    <div className="flex items-center gap-2.5">
      <input
        type="range" min={min} max={max} step={step}
        value={value}
        onChange={onChange}
        className="w-40 accent-[var(--accent)]"
      />
      <span className="w-11 text-right text-[12px] text-label-2 font-mono tabular-nums">{display}</span>
    </div>
  );
}

function Segmented({ options, value, onChange }) {
  return (
    <div className="segmented" role="group">
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function ColorControl({ value, fallback, onChange, onAuto, autoLabel }) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={value || fallback}
        onChange={(e) => onChange(e.target.value)}
        className="w-7 h-[22px] p-0.5 rounded-md border-[0.5px] border-control-border bg-control"
      />
      <button type="button" className={`btn ${!value ? "text-accent" : ""}`} onClick={onAuto} aria-pressed={!value}>
        {autoLabel}
      </button>
    </div>
  );
}

const CONTENT_OPTIONS = [
  { value: "off", key: "overlayContentOff" },
  { value: "translated", key: "overlayContentTranslated" },
  { value: "original", key: "overlayContentOriginal" },
  { value: "both", key: "overlayContentBoth" },
];

export default function OverlaySettings() {
  const { t } = useI18n();
  const { dispatch } = useSocketActions();
  const { overlaySettings: s } = useUI();

  const update = (patch) => {
    dispatch({ type: "UPDATE_OVERLAY_SETTINGS", payload: patch });
    // Sliders save on every step; reportError dedupes so an outage shows one toast
    saveOverlaySettings({ ...s, ...patch }).catch((err) => reportError(dispatch, err, "errSaveOverlaySettings"));
  };

  const isDark = s.bgColor === "dark";
  const defaultColor = isDark ? "#ffffff" : "#1a1a1a";
  const autoMuted = isDark ? "#808080" : "#666666";

  const cap = (v) => v.charAt(0).toUpperCase() + v.slice(1);

  return (
    <div className="space-y-5">
      <div className="group-box">
        <div className="group-row">
          <span>{strip(t("overlayOpacity"))}</span>
          <Slider min="0.1" max="1" step="0.05" value={s.opacity}
            onChange={(e) => update({ opacity: parseFloat(e.target.value) })}
            display={`${Math.round(s.opacity * 100)}%`} />
        </div>
        <div className="group-row">
          <span>{strip(t("overlayFontScale"))}</span>
          <Slider min="0.7" max="1.8" step="0.05" value={s.scale}
            onChange={(e) => update({ scale: parseFloat(e.target.value) })}
            display={`${Math.round(s.scale * 100)}%`} />
        </div>
        <div className="group-row">
          <span>{strip(t("overlayMaxLines"))}</span>
          <Slider min="1" max="15" step="1" value={s.maxLines}
            onChange={(e) => update({ maxLines: parseInt(e.target.value) })}
            display={s.maxLines} />
        </div>
        <div className="group-row">
          <span>{strip(t("overlayFontFamily"))}</span>
          <select
            className="select w-48"
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
        <div className="group-row">
          <span>{strip(t("overlayTextAlign"))}</span>
          <Segmented
            options={["left", "center", "right"].map((a) => ({ value: a, label: t(`overlayAlign${cap(a)}`) }))}
            value={s.textAlign}
            onChange={(v) => update({ textAlign: v })}
          />
        </div>
        <div className="group-row">
          <span>{strip(t("overlayBgColor"))}</span>
          <Segmented
            options={["dark", "light"].map((bg) => ({ value: bg, label: t(`overlayBg${cap(bg)}`) }))}
            value={s.bgColor}
            onChange={(v) => update({ bgColor: v })}
          />
        </div>
      </div>

      <div className="group-box">
        <div className="group-row">
          <span>{strip(t("overlayFinalContent"))}</span>
          <select
            className="select w-48"
            value={s.finalContent}
            onChange={(e) => update({ finalContent: e.target.value })}
          >
            {CONTENT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{t(o.key)}</option>
            ))}
          </select>
        </div>
        <div className="group-row">
          <span>{strip(t("overlayPartialContent"))}</span>
          <select
            className="select w-48"
            value={s.partialContent}
            onChange={(e) => update({ partialContent: e.target.value })}
          >
            {CONTENT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{t(o.key)}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <p className="section-header mb-1.5">{t("overlayTranslatedStyle")}</p>
        <div className="group-box">
          <div className="group-row">
            <span>{strip(t("overlayFontSize"))}</span>
            <Slider min="0.5" max="2" step="0.05" value={s.translatedFontSize}
              onChange={(e) => update({ translatedFontSize: parseFloat(e.target.value) })}
              display={`${s.translatedFontSize}em`} />
          </div>
          <div className="group-row">
            <span>{strip(t("overlayColor"))}</span>
            <ColorControl
              value={s.translatedColor} fallback={defaultColor}
              onChange={(v) => update({ translatedColor: v })}
              onAuto={() => update({ translatedColor: "" })}
              autoLabel={t("overlayColorAuto")}
            />
          </div>
        </div>
      </div>

      <div>
        <p className="section-header mb-1.5">{t("overlayOriginalStyle")}</p>
        <div className="group-box">
          <div className="group-row">
            <span>{strip(t("overlayFontSize"))}</span>
            <Slider min="0.5" max="2" step="0.05" value={s.originalFontSize}
              onChange={(e) => update({ originalFontSize: parseFloat(e.target.value) })}
              display={`${s.originalFontSize}em`} />
          </div>
          <div className="group-row">
            <span>{strip(t("overlayColor"))}</span>
            <ColorControl
              value={s.originalColor} fallback={autoMuted}
              onChange={(v) => update({ originalColor: v })}
              onAuto={() => update({ originalColor: "" })}
              autoLabel={t("overlayColorAuto")}
            />
          </div>
        </div>
      </div>

      <div>
        <p className="section-header mb-1.5">{t("overlayPreview")}</p>
        {(() => {
          const tColor = s.translatedColor || defaultColor;
          const oColor = s.originalColor || (isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.45)");
          const bgPreview = isDark ? `rgba(0,0,0,${s.opacity})` : `rgba(255,255,255,${s.opacity})`;
          const showTranslated = s.finalContent === "translated" || s.finalContent === "both";
          const showOriginal = s.finalContent === "original" || s.finalContent === "both";
          const pTranslated = s.partialContent === "translated" || s.partialContent === "both";
          const pOriginal = s.partialContent === "original" || s.partialContent === "both";
          return (
            <div className="border-[0.5px] border-separator" style={{
              background: bgPreview,
              borderRadius: 10,
              padding: "10px 14px",
              fontFamily: s.fontFamily,
              fontSize: `${s.scale}rem`,
              textAlign: s.textAlign,
            }}>
              {s.finalContent !== "off" && (
                <div style={{ marginBottom: 6 }}>
                  {showTranslated && (
                    <div style={{ color: tColor, fontWeight: 500, fontSize: `${s.translatedFontSize}em` }}>
                      Translated sample text
                    </div>
                  )}
                  {showOriginal && (
                    <div style={{ color: oColor, fontSize: `${s.originalFontSize}em` }}>
                      Original sample text
                    </div>
                  )}
                </div>
              )}
              {s.partialContent !== "off" && (
                <div style={{ opacity: 0.7 }}>
                  {pTranslated && (
                    <div style={{ color: tColor, fontWeight: 500, fontStyle: "italic", fontSize: `${s.translatedFontSize}em` }}>
                      Partial translated...
                    </div>
                  )}
                  {pOriginal && (
                    <div style={{ color: oColor, fontStyle: "italic", fontSize: `${s.originalFontSize}em` }}>
                      Partial original...
                    </div>
                  )}
                </div>
              )}
              {s.finalContent === "off" && s.partialContent === "off" && (
                <div style={{ color: isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.45)", fontSize: "0.85em" }}>
                  ...
                </div>
              )}
            </div>
          );
        })()}
      </div>
    </div>
  );
}
