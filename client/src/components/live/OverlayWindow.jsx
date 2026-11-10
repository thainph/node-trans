import { useRef, useEffect, useState } from "react";
import { ArrowDown, X } from "lucide-react";
import { useSocketActions, useTranscript, useUI } from "../../context/SocketContext";
import { useI18n } from "../../i18n/I18nContext";
import useDraggable from "../../hooks/useDraggable";

const DEFAULT_FONT = "system-ui, sans-serif";

// In-page HUD styles (the user's overlay colors don't follow the app theme, so no tokens)
const HUD_CSS = `
.nt-hud-bar {
  position: absolute; top: 0; left: 0; right: 0; height: 24px;
  display: flex; align-items: center; justify-content: flex-end; padding: 0 6px;
  opacity: 0; transition: opacity 150ms ease-out; touch-action: none; z-index: 1;
}
.nt-hud:hover .nt-hud-bar, .nt-hud-bar[data-dragging="true"] { opacity: 1; }
.nt-hud-btn {
  display: flex; align-items: center; justify-content: center; gap: 4px;
  border: none; background: var(--hud-fill); color: var(--hud-muted); cursor: default;
}
.nt-hud-btn:hover { background: var(--hud-fill-strong); color: var(--hud-text); }
.nt-hud-btn:focus-visible { outline: 2px solid var(--hud-muted); outline-offset: 1px; }
.nt-hud-close { width: 20px; height: 20px; border-radius: 50%; }
@keyframes nt-hud-in { from { opacity: 0; } }
@keyframes nt-hud-settle { from { opacity: 0.7; } }
.nt-hud-line { animation: nt-hud-settle 150ms ease-out; }
.nt-hud-line[data-partial="true"] { animation-name: nt-hud-in; }
@media (prefers-reduced-motion: reduce) {
  .nt-hud-bar { transition: none; }
  .nt-hud-line { animation: none; }
}
`;

export default function OverlayWindow() {
  const { dispatch } = useSocketActions();
  const { utterances, partialResults } = useTranscript();
  const { overlaySettings: s } = useUI();
  const { t } = useI18n();
  const { position, isDragging, dragRef, dragHandlers } = useDraggable({
    x: window.innerWidth / 2 - 250,
    y: window.innerHeight - 260,
  });
  const scrollRef = useRef(null);
  const isAtBottom = useRef(true);
  const [showJumpBtn, setShowJumpBtn] = useState(false);

  const finalOn = s.finalContent !== "off";
  const partialOn = s.partialContent !== "off";
  const finalTranslated = s.finalContent === "translated" || s.finalContent === "both";
  const finalOriginal = s.finalContent === "original" || s.finalContent === "both";
  const partialTranslated = s.partialContent === "translated" || s.partialContent === "both";
  const partialOriginal = s.partialContent === "original" || s.partialContent === "both";

  const partialEntries = Object.entries(partialResults);
  const visibleUtterances = finalOn ? utterances.slice(-s.maxLines) : [];
  const visiblePartials = partialOn ? partialEntries.filter(([, p]) => p.translatedText || p.originalText) : [];
  const firstIndex = utterances.length - visibleUtterances.length;

  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
    isAtBottom.current = atBottom;
    if (atBottom) setShowJumpBtn(false);
  }

  function jumpToBottom() {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    isAtBottom.current = true;
    setShowJumpBtn(false);
  }

  useEffect(() => {
    if (!scrollRef.current) return;
    if (isAtBottom.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    } else {
      setShowJumpBtn(true);
    }
  }, [utterances.length, partialResults]);

  const isDark = s.bgColor === "dark";
  const tint = isDark ? `rgba(20, 20, 20, ${s.opacity})` : `rgba(246, 246, 246, ${s.opacity})`;
  const defaultTextColor = isDark ? "rgba(255,255,255,0.95)" : "rgba(0,0,0,0.88)";
  const mutedColor = isDark ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.5)";
  const translatedColor = s.translatedColor || defaultTextColor;
  const originalColor = s.originalColor || mutedColor;

  const translatedStyle = { fontWeight: 600, color: translatedColor, fontSize: `${s.translatedFontSize}em` };
  const originalStyle = { fontWeight: 400, color: originalColor, fontSize: `${s.originalFontSize}em` };

  return (
    <div
      ref={dragRef}
      className="nt-hud"
      style={{
        "--hud-text": defaultTextColor,
        "--hud-muted": mutedColor,
        "--hud-fill": isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.06)",
        "--hud-fill-strong": isDark ? "rgba(255,255,255,0.22)" : "rgba(0,0,0,0.12)",
        position: "fixed",
        left: position.x,
        top: position.y,
        zIndex: 9999,
        width: 500,
        maxWidth: "90vw",
        background: tint,
        backdropFilter: "blur(20px) saturate(180%)",
        WebkitBackdropFilter: "blur(20px) saturate(180%)",
        color: defaultTextColor,
        borderRadius: 12,
        border: `0.5px solid ${isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)"}`,
        boxShadow: "var(--shadow-popover)",
        overflow: "hidden",
        fontSize: `${s.scale}rem`,
        fontFamily: s.fontFamily === DEFAULT_FONT ? "var(--font-sans)" : s.fontFamily,
        textAlign: s.textAlign,
      }}
      // Pointer capture lands on the container, so move/up live here; down is on the bar
      onPointerMove={dragHandlers.onPointerMove}
      onPointerUp={dragHandlers.onPointerUp}
    >
      <style>{HUD_CSS}</style>

      {/* Drag bar — revealed on hover */}
      <div
        className="nt-hud-bar"
        data-dragging={isDragging}
        style={{ cursor: isDragging ? "grabbing" : "grab" }}
        onPointerDown={dragHandlers.onPointerDown}
      >
        <button
          type="button"
          className="nt-hud-btn nt-hud-close"
          aria-label={t("overlayClose")}
          title={t("overlayClose")}
          onClick={() => dispatch({ type: "TOGGLE_OVERLAY" })}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <X size={14} strokeWidth={1.75} />
        </button>
      </div>

      {/* Content */}
      <div
        ref={scrollRef}
        className="selectable"
        style={{
          position: "relative",
          padding: "10px 14px",
          maxHeight: 200,
          overflowY: "auto",
          overflowX: "hidden",
        }}
        onScroll={handleScroll}
      >
        {visibleUtterances.length === 0 && visiblePartials.length === 0 && (
          <div style={{ color: mutedColor, fontSize: "0.85em", padding: "6px 0" }}>…</div>
        )}
        {visibleUtterances.map((u, i) => {
          const translation = u.translatedText || u.translated_text;
          const original = u.originalText || u.original_text;
          return (
            <div key={firstIndex + i} className="nt-hud-line" style={{ marginBottom: 8, lineHeight: 1.4 }}>
              {finalTranslated && translation && <div style={translatedStyle}>{translation}</div>}
              {finalOriginal && original && <div style={originalStyle}>{original}</div>}
            </div>
          );
        })}
        {visiblePartials.map(([source, data]) => (
          <div
            key={source}
            className="nt-hud-line"
            data-partial="true"
            style={{ marginBottom: 8, lineHeight: 1.4, opacity: 0.7 }}
          >
            {partialTranslated && data.translatedText && <div style={translatedStyle}>{data.translatedText}</div>}
            {partialOriginal && data.originalText && <div style={originalStyle}>{data.originalText}</div>}
          </div>
        ))}
        {showJumpBtn && (
          <button
            type="button"
            className="nt-hud-btn"
            onClick={jumpToBottom}
            style={{
              position: "sticky",
              bottom: 4,
              float: "right",
              height: 20,
              padding: "0 8px",
              borderRadius: 10,
              fontSize: 11,
              fontWeight: 500,
              fontFamily: "var(--font-sans)",
            }}
          >
            <ArrowDown size={12} strokeWidth={1.75} />
            {t("overlayJumpNew")}
          </button>
        )}
      </div>
    </div>
  );
}
