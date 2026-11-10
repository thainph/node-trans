import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { useSocketActions, useUI } from "../context/SocketContext";
import { useI18n } from "../i18n/I18nContext";
import { errorReason } from "../utils/errors";

const icons = {
  error:   { Icon: AlertCircle, cls: "text-sys-red" },
  success: { Icon: CheckCircle2, cls: "text-sys-green" },
  "":      { Icon: Info, cls: "text-accent" },
};

/**
 * Toast text: `key` (i18n, with `{reason}` filled from `error`), else the raw `message`.
 * A toast with only `error` shows the reason itself.
 */
function formatToast(t, toast) {
  const reason = toast.error ? errorReason(t, toast.error) : "";
  if (toast.key) return t(toast.key, { ...toast.params, reason });
  if (toast.message) return reason ? `${toast.message}: ${reason}` : toast.message;
  return reason;
}

function ToastItem({ toast }) {
  const { dispatch } = useSocketActions();
  const { t } = useI18n();
  const [shown, setShown] = useState(false);
  const [hovered, setHovered] = useState(false);

  const dismiss = () => dispatch({ type: "DISMISS_TOAST", payload: toast.id });

  // Slide in from the right on mount
  useEffect(() => {
    const raf = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    // Errors stay long enough to read; hovering pauses the timer
    if (hovered) return;
    const ms = toast.type === "error" ? 8000 : 3500;
    const timer = setTimeout(dismiss, ms);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast.id, hovered]);

  const text = formatToast(t, toast);

  useEffect(() => {
    if (toast.type === "error") {
      console.error("[Toast Error]", text, toast.params || "");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast.id]);

  const { Icon, cls } = icons[toast.type] ?? icons[""];

  return (
    <div
      role={toast.type === "error" ? "alert" : "status"}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`group flex items-start gap-2.5 w-[320px] max-w-[calc(100vw-24px)] pl-3 pr-2 py-2.5 rounded-[16px] text-[12px] text-label glass-panel pointer-events-auto transition-[transform,opacity] duration-200 ease-out ${
        shown ? "translate-x-0 opacity-100" : "translate-x-6 opacity-0"
      }`}
    >
      <Icon size={16} strokeWidth={1.75} className={`shrink-0 mt-px ${cls}`} />
      <span className={`selectable flex-1 leading-snug break-words ${toast.type === "error" ? "line-clamp-5" : "line-clamp-3"}`} title={text}>{text}</span>
      <button
        onClick={dismiss}
        className="btn-icon min-w-5 h-5 px-0 -mt-0.5 opacity-60 hover:opacity-100"
        aria-label={t("toastDismiss")}
        title={t("toastDismiss")}
      >
        <X size={12} strokeWidth={2} />
      </button>
    </div>
  );
}

export default function ToastContainer() {
  const { toasts } = useUI();
  if (!toasts?.length) return null;

  return (
    <div className="fixed top-[60px] right-3 z-[70] flex flex-col gap-2 items-end pointer-events-none">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  );
}
