// Tags <html> with platform info so CSS can opt into native chrome:
//   data-platform="darwin|win32|linux"   data-electron   data-vibrancy   data-fullscreen
// and keeps the system accent color + window focus state in sync.
export function initPlatform() {
  const root = document.documentElement;
  const api = window.electronAPI;
  const platform = api?.platform || (/Mac/.test(navigator.platform) ? "darwin" : /Win/.test(navigator.platform) ? "win32" : "linux");
  root.dataset.platform = platform;

  const setFocused = (focused) => root.classList.toggle("window-focused", focused);
  setFocused(document.hasFocus());
  window.addEventListener("focus", () => setFocused(true));
  window.addEventListener("blur", () => setFocused(false));

  if (!api?.isElectron) return;
  root.dataset.electron = "";
  if (platform === "darwin") root.dataset.vibrancy = "";

  api.onFullscreenChange?.((full) => {
    if (full) root.dataset.fullscreen = "";
    else delete root.dataset.fullscreen;
  });

  const setAccent = (hex) => {
    if (hex) root.style.setProperty("--accent", hex);
  };
  api.getAccentColor?.().then(setAccent).catch(() => {});
  api.onAccentColorChange?.(setAccent);
}
