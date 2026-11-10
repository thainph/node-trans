import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { useSocketActions, useUI } from "../context/SocketContext";
import { useI18n } from "../i18n/I18nContext";

const icons = {
  error:   { Icon: AlertCircle, cls: "text-sys-red" },
  success: { Icon: CheckCircle2, cls: "text-sys-green" },
  "":      { Icon: Info, cls: "text-accent" },
};

function ToastItem({ toast }) {
  const { dispatch } = useSocketActions();
  const { t } = useI18n();
  const [shown, setShown] = useState(false);

  const dismiss = () => dispatch({ type: "DISMISS_TOAST", payload: toast.id });

  // Slide in from the right on mount
  useEffect(() => {
    const raf = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    const ms = toast.type === "error" ? 7000 : 3500;
    const timer = setTimeout(dismiss, ms);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast.id]);

  const text = toast.key ? t(toast.key, toast.params) : (toast.message || "");

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
      className={`group flex items-start gap-2.5 w-[320px] max-w-[calc(100vw-24px)] pl-3 pr-2 py-2.5 rounded-[16px] text-[12px] text-label glass-panel pointer-events-auto transition-[transform,opacity] duration-200 ease-out ${
        shown ? "translate-x-0 opacity-100" : "translate-x-6 opacity-0"
      }`}
    >
      <Icon size={16} strokeWidth={1.75} className={`shrink-0 mt-px ${cls}`} />
      <span className="selectable flex-1 leading-snug break-words line-clamp-3" title={text}>{text}</span>
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
