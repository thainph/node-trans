import { useState, useEffect } from "react";

// Theme preference: "system" | "light" | "dark". "system" follows the OS appearance.
const KEY = "theme";
const listeners = new Set();
const media = window.matchMedia("(prefers-color-scheme: dark)");

function readPref() {
  const v = localStorage.getItem(KEY);
  return v === "light" || v === "dark" ? v : "system";
}

function apply(pref) {
  const resolved = pref === "system" ? (media.matches ? "dark" : "light") : pref;
  document.documentElement.setAttribute("data-theme", resolved);
  // Keep native chrome (vibrancy, menus, dialogs) in the same appearance
  window.electronAPI?.setTheme?.(pref);
}

export function initTheme() {
  apply(readPref());
  media.addEventListener("change", () => {
    if (readPref() === "system") apply("system");
  });
}

export function useTheme() {
  const [pref, setPref] = useState(readPref);

  useEffect(() => {
    listeners.add(setPref);
    return () => listeners.delete(setPref);
  }, []);

  const setTheme = (next) => {
    localStorage.setItem(KEY, next);
    apply(next);
    listeners.forEach((fn) => fn(next));
  };

  return [pref, setTheme];
}
