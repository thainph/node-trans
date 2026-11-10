import { Component, useState } from "react";
import { AlertTriangle, ChevronRight, RotateCw, Copy, Check } from "lucide-react";
import { useI18n } from "../i18n/I18nContext";
import { en, vi } from "../i18n/locales.js";
import { errorMessage } from "../utils/errors";

/*
 * Error boundaries: a render error shows a readable fallback instead of a blank window.
 *
 *   <ErrorBoundary>                    full-window fallback with Reload (app root)
 *   <ErrorBoundary variant="inline">   compact fallback with Try Again (one panel)
 *   <ErrorBoundary renderFallback={(p) => …}>   custom wrapper around <ErrorFallback {...p} />
 *   onError={(error, info) => …}        also report it (e.g. a toast when the fallback is empty)
 */

// The root boundary sits outside I18nProvider, so fall back to reading the language directly
function useSafeT() {
  const i18n = useI18n();
  if (i18n?.t) return i18n.t;
  let lang = "en";
  try {
    lang = localStorage.getItem("node-trans-lang") || (navigator.language?.toLowerCase().startsWith("vi") ? "vi" : "en");
  } catch {
    // Storage blocked — English is fine for a crash screen
  }
  const dict = lang === "vi" ? vi : en;
  return (key) => dict[key] || en[key] || key;
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Clipboard API unavailable (no focus / permissions) — use the legacy path
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  }
}

export function ErrorFallback({ error, componentStack, reset, onClose, variant = "full" }) {
  const t = useSafeT();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const inline = variant === "inline";
  const message = errorMessage(error);
  const details = [message, error?.stack, componentStack && `Component stack:${componentStack}`]
    .filter(Boolean).join("\n\n");

  const copy = async () => {
    if (await copyText(details)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  return (
    <div
      role="alert"
      className={inline
        ? "flex-1 min-h-0 flex items-center justify-center p-6 text-label"
        : "h-screen w-screen flex items-center justify-center p-8 bg-content text-label"}
    >
      <div className={`flex flex-col items-center text-center w-full ${inline ? "max-w-[400px]" : "max-w-[520px]"}`}>
        <AlertTriangle size={inline ? 28 : 40} strokeWidth={1.5} className="text-sys-orange mb-3" />
        <h2 className="text-[15px] font-semibold mb-1.5">{t(inline ? "errBoundaryPanelTitle" : "errBoundaryTitle")}</h2>
        <p className="selectable font-mono text-[11px] text-label-2 leading-snug break-words max-w-full mb-3">{message}</p>

        {(componentStack || error?.stack) && (
          <div className="w-full mb-4 text-left">
            <button
              type="button"
              className="btn mx-auto flex"
              aria-expanded={open}
              onClick={() => setOpen((o) => !o)}
            >
              <ChevronRight size={14} strokeWidth={1.75} className={`transition-transform ${open ? "rotate-90" : ""}`} />
              {t("errBoundaryDetails")}
            </button>
            {open && (
              <pre className="selectable mt-2 max-h-[220px] overflow-auto rounded-[10px] bg-grouped border-[0.5px] border-separator p-2.5 font-mono text-[10.5px] leading-snug text-label-2 whitespace-pre-wrap break-words">
                {details}
              </pre>
            )}
          </div>
        )}

        <div className="flex flex-wrap justify-center gap-2">
          {onClose && <button type="button" className="btn" onClick={onClose}>{t("errBoundaryClose")}</button>}
          <button type="button" className="btn" onClick={copy}>
            {copied ? <Check size={14} strokeWidth={1.75} /> : <Copy size={14} strokeWidth={1.75} />}
            {t(copied ? "errBoundaryCopied" : "errBoundaryCopy")}
          </button>
          {inline ? (
            <button type="button" className="btn btn-primary" onClick={reset}>
              <RotateCw size={14} strokeWidth={1.75} />
              {t("errBoundaryRetry")}
            </button>
          ) : (
            <button type="button" className="btn btn-primary" onClick={() => location.reload()}>
              <RotateCw size={14} strokeWidth={1.75} />
              {t("errBoundaryReload")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Last line of defence: if the fallback itself throws, show plain text
class FallbackGuard extends Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(err) {
    console.error("[ErrorBoundary] fallback failed:", err);
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div role="alert" style={{ padding: 24, font: "13px system-ui, sans-serif" }}>
        Something went wrong: {errorMessage(this.props.error)}{" "}
        <button type="button" onClick={() => location.reload()}>Reload</button>
      </div>
    );
  }
}

export default class ErrorBoundary extends Component {
  state = { error: null, componentStack: "" };

  static getDerivedStateFromError(error) {
    return { error: error ?? new Error("Unknown render error") };
  }

  componentDidCatch(error, info) {
    console.error(`[ErrorBoundary${this.props.name ? `:${this.props.name}` : ""}]`, error, info?.componentStack);
    this.setState({ componentStack: info?.componentStack || "" });
    try {
      this.props.onError?.(error, info);
    } catch (e) {
      console.error("[ErrorBoundary] onError failed:", e);
    }
  }

  reset = () => this.setState({ error: null, componentStack: "" });

  // A new `resetKey` (e.g. another session selected) clears the error automatically
  componentDidUpdate(prev) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.reset();
  }

  render() {
    const { error, componentStack } = this.state;
    if (!error) return this.props.children;
    const { variant = "full", renderFallback } = this.props;
    const props = { error, componentStack, reset: this.reset, variant };
    return (
      <FallbackGuard error={error}>
        {renderFallback ? renderFallback(props) : <ErrorFallback {...props} />}
      </FallbackGuard>
    );
  }
}
