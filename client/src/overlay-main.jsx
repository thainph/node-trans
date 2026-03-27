import React, { useState, useEffect, useRef } from "react";
import ReactDOM from "react-dom/client";

const DEFAULTS = {
  opacity: 0.8,
  scale: 1,
  displayMode: "both",
  textAlign: "left",
  bgColor: "dark",
  maxLines: 5,
  fontFamily: "system-ui, sans-serif",
};

function OverlayApp() {
  const [utterances, setUtterances] = useState([]);
  const [partials, setPartials] = useState({});
  const [settings, setSettings] = useState(DEFAULTS);
  const scrollRef = useRef(null);

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
  const showFinal = s.displayMode === "both" || s.displayMode === "final-only";
  const showPartial =
    s.displayMode === "both" || s.displayMode === "partial-only";
  const visibleUtterances = showFinal ? utterances.slice(-s.maxLines) : [];
  const visiblePartials = showPartial
    ? Object.entries(partials).filter(
        ([, p]) => p.translatedText || p.originalText
      )
    : [];

  const isDark = s.bgColor === "dark";
  const bg = isDark
    ? `rgba(0, 0, 0, ${s.opacity})`
    : `rgba(255, 255, 255, ${s.opacity})`;
  const textColor = isDark ? "#fff" : "#1a1a1a";
  const mutedColor = isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.45)";
  const borderColor = isDark
    ? "rgba(255,255,255,0.1)"
    : "rgba(0,0,0,0.1)";

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        background: bg,
        color: textColor,
        fontSize: `${s.scale}rem`,
        fontFamily: s.fontFamily,
        textAlign: s.textAlign,
        WebkitAppRegion: "drag",
        display: "flex",
        flexDirection: "column",
        borderRadius: 14,
        border: `1px solid ${borderColor}`,
        overflow: "hidden",
        backdropFilter: "blur(12px)",
      }}
    >
      {/* Title bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "6px 12px",
          borderBottom: `1px solid ${borderColor}`,
          fontSize: "0.7rem",
          color: mutedColor,
          flexShrink: 0,
        }}
      >
        <span>Node Trans</span>
        <button
          onClick={() => window.overlayAPI?.close()}
          style={{
            WebkitAppRegion: "no-drag",
            background: "none",
            border: "none",
            color: mutedColor,
            cursor: "pointer",
            fontSize: "1rem",
            lineHeight: 1,
            padding: "0 2px",
          }}
        >
          &times;
        </button>
      </div>

      {/* Content */}
      <div
        ref={scrollRef}
        style={{
          padding: "8px 12px",
          flex: 1,
          overflowY: "auto",
          overflowX: "hidden",
          WebkitAppRegion: "no-drag",
        }}
      >
        {visibleUtterances.length === 0 && visiblePartials.length === 0 && (
          <div
            style={{ color: mutedColor, fontSize: "0.85em", padding: "8px 0" }}
          >
            ...
          </div>
        )}
        {visibleUtterances.map((u, i) => {
          const translation = u.translatedText || u.translated_text;
          const original = u.originalText || u.original_text;
          return (
            <div key={i} style={{ marginBottom: 6, lineHeight: 1.5 }}>
              {translation && <div style={{ fontWeight: 500 }}>{translation}</div>}
              {original && (
                <div style={{ fontSize: "0.8em", color: mutedColor }}>
                  {original}
                </div>
              )}
            </div>
          );
        })}
        {visiblePartials.map(([source, data]) => (
          <div
            key={source}
            style={{ marginBottom: 6, lineHeight: 1.5, opacity: 0.7 }}
          >
            {data.translatedText && (
              <div style={{ fontWeight: 500, fontStyle: "italic" }}>
                {data.translatedText}
              </div>
            )}
            {data.originalText && (
              <div
                style={{
                  fontSize: "0.8em",
                  color: mutedColor,
                  fontStyle: "italic",
                }}
              >
                {data.originalText}
              </div>
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
