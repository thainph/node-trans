import { useEffect } from "react";
import { useSocketActions } from "../context/SocketContext";
import { errorMessage, isDuplicate } from "../utils/errors";

// Browser noise that isn't a real failure
const IGNORED = [/ResizeObserver loop/i, /^Script error\.?$/i];

// preload's onAppError has no unsubscribe, so register it once per page (StrictMode remounts)
let appErrorHandler = null;
let appErrorSubscribed = false;

/**
 * Mount once (AppContent): uncaught errors, unhandled promise rejections and main-process
 * errors from Electron (`electronAPI.onAppError`) become error toasts instead of vanishing.
 */
export function useGlobalErrors() {
  const { dispatch } = useSocketActions();

  useEffect(() => {
    const show = (key, reason) => {
      if (!reason || IGNORED.some((re) => re.test(reason))) return;
      if (isDuplicate(`${key}|${reason}`)) return;
      dispatch({ type: "TOAST", payload: { type: "error", key, error: { message: reason } } });
    };

    const onError = (e) => {
      // Resource load errors (img/script) have no message and aren't actionable here
      const reason = e.error ? errorMessage(e.error) : e.message;
      show("errUnexpected", reason);
    };
    const onRejection = (e) => show("errUnexpected", errorMessage(e.reason));

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);

    appErrorHandler = (payload) => {
      const message = errorMessage(payload?.message ?? payload);
      const detail = typeof payload?.detail === "string" ? payload.detail.trim() : "";
      console.error("[main]", message, detail);
      const short = detail.length > 160 ? `${detail.slice(0, 160)}…` : detail;
      show("errAppMain", short ? `${message} — ${short}` : message);
    };
    if (!appErrorSubscribed && window.electronAPI?.onAppError) {
      appErrorSubscribed = true;
      window.electronAPI.onAppError((payload) => appErrorHandler?.(payload));
    }

    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
      appErrorHandler = null;
    };
  }, [dispatch]);
}
