import { useEffect, useRef } from "react";
import { useI18n } from "../i18n/I18nContext";

// Kept for callers that style their own footer buttons
export const btnPrimary = "btn btn-primary";
export const btnCancel = "btn";

// Open sheets, innermost last — only the top one reacts to Escape / Enter
const sheetStack = [];

// macOS-style sheet. Escape closes, Enter triggers the button marked `data-default`
// (forms handle Enter themselves). The first field, else the default button, gets focus.
export function ModalBase({ open, onClose, children, className = "", width = 380, closeOnBackdrop = true }) {
  const sheetRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const id = {};
    sheetStack.push(id);

    const sheet = sheetRef.current;
    const first = sheet?.querySelector("[data-autofocus], input:not([type=hidden]):not(:disabled), textarea, select")
      || sheet?.querySelector("[data-default]");
    first?.focus();

    const handler = (e) => {
      if (sheetStack[sheetStack.length - 1] !== id) return;
      if (e.key === "Escape") {
        e.preventDefault();
        onCloseRef.current?.();
      } else if (e.key === "Enter" && !e.isComposing) {
        const target = e.target;
        if (target.closest?.("form") || target.tagName === "TEXTAREA" || target.tagName === "BUTTON" || target.tagName === "SELECT") return;
        const btn = sheet?.querySelector("[data-default]:not(:disabled)");
        if (btn) { e.preventDefault(); btn.click(); }
      }
    };
    document.addEventListener("keydown", handler);
    return () => {
      document.removeEventListener("keydown", handler);
      const i = sheetStack.indexOf(id);
      if (i !== -1) sheetStack.splice(i, 1);
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="sheet-backdrop" onMouseDown={closeOnBackdrop ? onClose : undefined}>
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        className={`sheet max-w-[calc(100vw-32px)] ${className}`}
        style={width ? { width } : undefined}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

export function ConfirmDialog({ open, title, message, confirmLabel, confirmColor = "red", onConfirm, onCancel }) {
  const { t } = useI18n();
  const isDestructive = confirmColor !== "blue";
  const confirmCls = isDestructive ? "btn btn-destructive" : "btn btn-primary";

  return (
    <ModalBase open={open} onClose={onCancel} width={340} className="p-5">
      <h3 className="text-[13px] font-semibold text-label mb-1.5">{title}</h3>
      <p className="text-[12px] text-label-2 leading-snug mb-5">{message}</p>
      <div className="flex justify-end gap-2">
        {/* Like macOS, a destructive action is never the default: focus Cancel and ignore Enter */}
        <button className="btn" onClick={onCancel} data-autofocus={isDestructive || undefined}>{t("cancel")}</button>
        <button className={confirmCls} onClick={onConfirm} data-default={!isDestructive || undefined}>
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
    <ModalBase open={open} onClose={onCancel} width={340} className="p-5">
      <h3 className="text-[13px] font-semibold text-label mb-3">{title}</h3>
      <form onSubmit={handleSubmit}>
        <input
          ref={inputRef}
          type="text"
          defaultValue={defaultValue}
          placeholder={placeholder}
          className="field w-full mb-5"
        />
        <div className="flex justify-end gap-2">
          <button type="button" className="btn" onClick={onCancel}>{t("cancel")}</button>
          <button type="submit" className="btn btn-primary" data-default>
            {t("save")}
          </button>
        </div>
      </form>
    </ModalBase>
  );
}
