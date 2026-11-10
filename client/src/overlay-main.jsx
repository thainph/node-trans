import React, { useState, useEffect, useRef, useCallback } from "react";
import ReactDOM from "react-dom/client";
import { X } from "lucide-react";

const SYSTEM_FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, "Segoe UI Variable", "Segoe UI", Roboto, sans-serif';
// The overlay window has no i18n context; follow the system language for its one label
const CLOSE_LABEL = navigator.language?.toLowerCase().startsWith("vi") ? "\u0110\u00F3ng" : "Close";

const DEFAULTS = {
  opacity: 0.8,
  scale: 1,
  textAlign: "left",
  bgColor: "dark",
  maxLines: 5,
  fontFamily: "system-ui, sans-serif",
  finalContent: "both",
  partialContent: "both",
  translatedFontSize: 1,
  translatedColor: "",
  originalFontSize: 0.8,
  originalColor: "",
};

function OverlayApp() {
  const [utterances, setUtterances] = useState([]);
  const [partials, setPartials] = useState({});
  const [settings, setSettings] = useState(DEFAULTS);
  const scrollRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef(null);

  const onPointerDown = useCallback((e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    dragStartRef.current = { x: e.screenX, y: e.screenY };
    window.overlayAPI?.dragStart();
    setIsDragging(true);
  }, []);

  // Use document-level listeners for reliable dragging on macOS
  // transparent frameless Electron windows (element-level pointer
  // capture is unreliable when BrowserWindow moves via setPosition)
  useEffect(() => {
    if (!isDragging) return;

    const onMove = (e) => {
      if (!dragStartRef.current) return;
      const dx = e.screenX - dragStartRef.current.x;
      const dy = e.screenY - dragStartRef.current.y;
      window.overlayAPI?.dragMove(dx, dy);
    };

    const onUp = () => {
      setIsDragging(false);
      dragStartRef.current = null;
    };

    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
    return () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
    };
  }, [isDragging]);

  useEffect(() => {
    const api = window.overlayAPI;
    if (!api) return;

    api.onData((data) => {
      switch (data.type) {
        case "utterance":
          setUtterances((prev) => [...prev, data.payload]);
          break;
        case "partial":
          setPartials((prev) => ({
            ...prev,
            [data.payload.source || "mic"]: data.payload,
          }));
          break;
        case "utterance-clear-partial": {
          setUtterances((prev) => [...prev, data.payload]);
          setPartials((prev) => {
            const next = { ...prev };
            delete next[data.payload.source || "mic"];
            return next;
          });
          break;
        }
        case "clear":
          setUtterances([]);
          setPartials({});
          break;
        case "init":
          setUtterances(data.utterances || []);
          setPartials(data.partials || {});
          if (data.settings) setSettings((s) => ({ ...s, ...data.settings }));
          break;
      }
    });

    api.onSettings((s) => setSettings((prev) => ({ ...prev, ...s })));
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [utterances.length, partials]);

  const s = settings;
  const finalOn = s.finalContent !== "off";
  const partialOn = s.partialContent !== "off";
  const finalTranslated = s.finalContent === "translated" || s.finalContent === "both";
  const finalOriginal = s.finalContent === "original" || s.finalContent === "both";
  const partialTranslated = s.partialContent === "translated" || s.partialContent === "both";
  const partialOriginal = s.partialContent === "original" || s.partialContent === "both";

  const visibleUtterances = finalOn ? utterances.slice(-s.maxLines) : [];
  const visiblePartials = partialOn
    ? Object.entries(partials).filter(([, p]) => p.translatedText || p.originalText)
    : [];

  const isDark = s.bgColor === "dark";
  const tint = isDark ? `rgba(20, 20, 20, ${s.opacity})` : `rgba(246, 246, 246, ${s.opacity})`;
  const defaultTextColor = isDark ? "rgba(255,255,255,0.95)" : "rgba(0,0,0,0.88)";
  const mutedColor = isDark ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.5)";
  const translatedColor = s.translatedColor || defaultTextColor;
  const originalColor = s.originalColor || mutedColor;
  const fontFamily = s.fontFamily === DEFAULTS.fontFamily ? SYSTEM_FONT : s.fontFamily;

  const translatedStyle = {
    fontWeight: 600,
    color: translatedColor,
    fontSize: `${s.translatedFontSize}em`,
  };
  const originalStyle = {
    fontWeight: 400,
    color: originalColor,
    fontSize: `${s.originalFontSize}em`,
  };
  const firstIndex = utterances.length - visibleUtterances.length;

  return (
    <div
      className="hud"
      style={{
        "--hud-text": defaultTextColor,
        "--hud-muted": mutedColor,
        "--hud-fill": isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.06)",
        "--hud-fill-strong": isDark ? "rgba(255,255,255,0.22)" : "rgba(0,0,0,0.12)",
        position: "relative",
        width: "100vw",
        height: "100vh",
        background: tint,
        backdropFilter: "blur(20px) saturate(180%)",
        WebkitBackdropFilter: "blur(20px) saturate(180%)",
        color: defaultTextColor,
        fontSize: `${s.scale}rem`,
        fontFamily,
        textAlign: s.textAlign,
        display: "flex",
        flexDirection: "column",
        borderRadius: 12,
        border: `0.5px solid ${isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)"}`,
        overflow: "hidden",
      }}
    >
      {/* Drag bar — revealed on hover */}
      <div
        className="hud-bar"
        data-dragging={isDragging}
        style={{ cursor: isDragging ? "grabbing" : "grab" }}
        onPointerDown={onPointerDown}
      >
        <button
          type="button"
          className="hud-close"
          aria-label={CLOSE_LABEL}
          title={CLOSE_LABEL}
          onClick={() => window.overlayAPI?.close()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <X size={14} strokeWidth={1.75} />
        </button>
      </div>

      {/* Content */}
      <div
        ref={scrollRef}
        style={{
          padding: "10px 14px",
          flex: 1,
          overflowY: "auto",
          overflowX: "hidden",
        }}
      >
        {visibleUtterances.length === 0 && visiblePartials.length === 0 && (
          <div style={{ color: mutedColor, fontSize: "0.85em", padding: "6px 0" }}>
            …
          </div>
        )}
        {visibleUtterances.map((u, i) => {
          const translation = u.translatedText || u.translated_text;
          const original = u.originalText || u.original_text;
          return (
            <div key={firstIndex + i} className="hud-line" style={{ marginBottom: 8, lineHeight: 1.4 }}>
              {finalTranslated && translation && <div style={translatedStyle}>{translation}</div>}
              {finalOriginal && original && <div style={originalStyle}>{original}</div>}
            </div>
          );
        })}
        {visiblePartials.map(([source, data]) => (
          <div
            key={source}
            className="hud-line"
            data-partial="true"
            style={{ marginBottom: 8, lineHeight: 1.4, opacity: 0.7 }}
          >
            {partialTranslated && data.translatedText && (
              <div style={translatedStyle}>{data.translatedText}</div>
            )}
            {partialOriginal && data.originalText && (
              <div style={originalStyle}>{data.originalText}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <OverlayApp />
  </React.StrictMode>
);
