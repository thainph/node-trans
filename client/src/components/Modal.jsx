import { useEffect, useRef } from "react";
import { useI18n } from "../i18n/I18nContext";

const overlay = "fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md animate-[fadeIn_150ms_ease-out]";
const panel = "bg-white/95 dark:bg-[#0d0f1a]/95 backdrop-blur-xl border border-gray-200/50 dark:border-indigo-500/15 rounded-2xl shadow-2xl shadow-indigo-500/10 w-full max-w-sm mx-4 p-5 animate-[scaleIn_150ms_ease-out]";
const btnPrimary = "px-4 py-2 rounded-xl text-sm font-semibold cursor-pointer border-none transition-all duration-200 active:scale-95";
const btnCancel = "px-4 py-2 rounded-xl text-sm font-medium cursor-pointer transition-all duration-200 active:scale-95 bg-gray-100/80 dark:bg-white/5 text-gray-700 dark:text-gray-300 border border-gray-200/50 dark:border-indigo-500/10 hover:bg-gray-200/80 dark:hover:bg-white/10";

function ModalBase({ open, onClose, children }) {
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className={overlay} onMouseDown={onClose}>
      <div className={panel} onMouseDown={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

export function ConfirmDialog({ open, title, message, confirmLabel, confirmColor = "red", onConfirm, onCancel }) {
  const { t } = useI18n();
  const colorMap = {
    red: "bg-linear-to-r from-rose-600 to-pink-500 text-white shadow-md shadow-rose-500/20",
    blue: "bg-linear-to-r from-indigo-600 to-cyan-500 text-white shadow-md shadow-indigo-500/20",
  };

  return (
    <ModalBase open={open} onClose={onCancel}>
      <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 mb-2">{title}</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">{message}</p>
      <div className="flex justify-end gap-2">
        <button className={btnCancel} onClick={onCancel}>{t("cancel")}</button>
        <button className={`${btnPrimary} ${colorMap[confirmColor] || colorMap.red}`} onClick={onConfirm}>
          {confirmLabel || t("delete")}
        </button>
      </div>
    </ModalBase>
  );
}

export function PromptDialog({ open, title, defaultValue = "", placeholder = "", onConfirm, onCancel }) {
  const { t } = useI18n();
  const inputRef = useRef(null);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [open]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const val = inputRef.current?.value.trim();
    if (val) onConfirm(val);
  };

  return (
    <ModalBase open={open} onClose={onCancel}>
      <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 mb-3">{title}</h3>
      <form onSubmit={handleSubmit}>
        <input
          ref={inputRef}
          type="text"
          defaultValue={defaultValue}
          placeholder={placeholder}
          className="w-full px-3 py-2 rounded-xl text-sm bg-gray-50/80 dark:bg-white/5 text-gray-900 dark:text-gray-200 border border-gray-200/50 dark:border-indigo-500/10 outline-none transition-all duration-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 mb-4"
        />
        <div className="flex justify-end gap-2">
          <button type="button" className={btnCancel} onClick={onCancel}>{t("cancel")}</button>
          <button type="submit" className={`${btnPrimary} bg-linear-to-r from-indigo-600 to-cyan-500 text-white shadow-md shadow-indigo-500/20`}>
            {t("save")}
          </button>
        </div>
      </form>
    </ModalBase>
  );
}
