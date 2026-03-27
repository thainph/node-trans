import { useState, useRef, useCallback, useEffect } from "react";

const STORAGE_KEY = "overlay-position";

function loadPosition(defaultPos) {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return defaultPos;
}

function clamp(pos, elRect) {
  const maxX = window.innerWidth - elRect.width;
  const maxY = window.innerHeight - elRect.height;
  return {
    x: Math.max(0, Math.min(pos.x, maxX)),
    y: Math.max(0, Math.min(pos.y, maxY)),
  };
}

export default function useDraggable(defaultPosition = { x: 100, y: 100 }) {
  const [position, setPosition] = useState(() => loadPosition(defaultPosition));
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef(null);
  const offsetRef = useRef({ x: 0, y: 0 });

  const onPointerDown = useCallback((e) => {
    if (e.button !== 0) return;
    const el = dragRef.current;
    if (!el) return;

    e.preventDefault();
    el.setPointerCapture(e.pointerId);

    const rect = el.getBoundingClientRect();
    offsetRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    setIsDragging(true);
  }, []);

  const onPointerMove = useCallback(
    (e) => {
      if (!isDragging) return;
      const el = dragRef.current;
      if (!el) return;

      const rect = el.getBoundingClientRect();
      const newPos = clamp(
        {
          x: e.clientX - offsetRef.current.x,
          y: e.clientY - offsetRef.current.y,
        },
        rect
      );
      setPosition(newPos);
    },
    [isDragging]
  );

  const onPointerUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Persist position when dragging stops
  useEffect(() => {
    if (!isDragging) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(position));
    }
  }, [isDragging, position]);

  // Keep overlay in viewport on resize
  useEffect(() => {
    const handleResize = () => {
      const el = dragRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setPosition((prev) => clamp(prev, rect));
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return {
    position,
    isDragging,
    dragRef,
    dragHandlers: { onPointerDown, onPointerMove, onPointerUp },
  };
}
