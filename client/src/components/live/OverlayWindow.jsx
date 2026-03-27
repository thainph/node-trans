import { useRef, useEffect } from "react";
import { useSocket } from "../../context/SocketContext";
import useDraggable from "../../hooks/useDraggable";

export default function OverlayWindow() {
  const { state, dispatch } = useSocket();
  const { utterances, partialResults, overlaySettings: s } = state;
  const { position, isDragging, dragRef, dragHandlers } = useDraggable({
    x: window.innerWidth / 2 - 250,
    y: window.innerHeight - 260,
  });
  const scrollRef = useRef(null);

  const partialEntries = Object.entries(partialResults);
  const showFinal = s.displayMode === "both" || s.displayMode === "final-only";
  const showPartial = s.displayMode === "both" || s.displayMode === "partial-only";

  const visibleUtterances = showFinal ? utterances.slice(-s.maxLines) : [];
  const visiblePartials = showPartial ? partialEntries.filter(([, p]) => p.translatedText || p.originalText) : [];

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [utterances.length, partialResults]);

  const isDark = s.bgColor === "dark";
  const bg = isDark
    ? `rgba(0, 0, 0, ${s.opacity})`
    : `rgba(255, 255, 255, ${s.opacity})`;
  const textColor = isDark ? "#fff" : "#1a1a1a";
  const mutedColor = isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.45)";

  return (
    <div
      ref={dragRef}
      style={{
        position: "fixed",
        left: position.x,
        top: position.y,
        zIndex: 9999,
        width: 500,
        maxWidth: "90vw",
        background: bg,
        color: textColor,
        backdropFilter: "blur(12px)",
        borderRadius: 14,
        border: isDark ? "1px solid rgba(255,255,255,0.1)" : "1px solid rgba(0,0,0,0.1)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
        cursor: isDragging ? "grabbing" : "grab",
        userSelect: "none",
        fontSize: `${s.scale}rem`,
        fontFamily: s.fontFamily,
        textAlign: s.textAlign,
        touchAction: "none",
      }}
      {...dragHandlers}
    >
      {/* Title bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "6px 12px",
          borderBottom: isDark ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(0,0,0,0.06)",
          fontSize: "0.7rem",
          color: mutedColor,
        }}
      >
        <span>Node Trans</span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            dispatch({ type: "TOGGLE_OVERLAY" });
          }}
          onPointerDown={(e) => e.stopPropagation()}
          style={{
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
          maxHeight: 200,
          overflowY: "auto",
          overflowX: "hidden",
        }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {visibleUtterances.length === 0 && visiblePartials.length === 0 && (
          <div style={{ color: mutedColor, fontSize: "0.85em", padding: "8px 0" }}>
            ...
          </div>
        )}
        {visibleUtterances.map((u, i) => {
          const translation = u.translatedText || u.translated_text;
          const original = u.originalText || u.original_text;
          return (
            <div key={i} style={{ marginBottom: 6, lineHeight: 1.5 }}>
              {translation && (
                <div style={{ fontWeight: 500 }}>{translation}</div>
              )}
              {original && (
                <div style={{ fontSize: "0.8em", color: mutedColor }}>{original}</div>
              )}
            </div>
          );
        })}
        {visiblePartials.map(([source, data]) => (
          <div key={source} style={{ marginBottom: 6, lineHeight: 1.5, opacity: 0.7 }}>
            {data.translatedText && (
              <div style={{ fontWeight: 500, fontStyle: "italic" }}>{data.translatedText}</div>
            )}
            {data.originalText && (
              <div style={{ fontSize: "0.8em", color: mutedColor, fontStyle: "italic" }}>
                {data.originalText}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
