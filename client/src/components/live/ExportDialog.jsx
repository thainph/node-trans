import { useState } from "react";
import { useI18n } from "../../i18n/I18nContext";
import { getExportUrl, downloadFile } from "../../utils/api";
import { ModalBase, btnPrimary, btnCancel } from "../Modal";

const STORAGE_KEY = "node-trans-export";
const DEFAULTS = { format: "docx", content: "both", layout: "chat", group: false, timestamps: true, speakers: true, metadata: true };

const FORMATS = [
  { value: "docx", label: "Word (.docx)" },
  { value: "md", label: "Markdown (.md)" },
  { value: "txt", label: "Text (.txt)" },
];
const CONTENTS = [
  { value: "both", labelKey: "exportContentBoth" },
  { value: "original", labelKey: "exportContentOriginal" },
  { value: "translation", labelKey: "exportContentTranslation" },
];
const LAYOUTS = [
  { value: "chat", labelKey: "exportLayoutChat" },
  { value: "table", labelKey: "exportLayoutTable" },
];
const TOGGLES = [
  { key: "group", labelKey: "exportGroup" },
  { key: "timestamps", labelKey: "exportTimestamps" },
  { key: "speakers", labelKey: "exportSpeakers" },
  { key: "metadata", labelKey: "exportMetadata" },
];

const lCls = "block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5";
const chipBase = "flex-1 px-2 py-1.5 rounded-lg text-xs font-medium cursor-pointer border transition-all duration-200";
const chipOn = "bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 border-indigo-500/50";
const chipOff = "bg-gray-50/80 dark:bg-white/5 text-gray-600 dark:text-gray-400 border-gray-200/50 dark:border-indigo-500/10 hover:border-indigo-400";

function loadOptions() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") };
  } catch {
    return DEFAULTS;
  }
}

function ChipGroup({ options, value, onChange, t, disabled }) {
  return (
    <div className="flex gap-1.5">
      {options.map((o) => (
        <button key={o.value} type="button" disabled={disabled}
          className={`${chipBase} ${value === o.value ? chipOn : chipOff} disabled:opacity-40 disabled:cursor-not-allowed`}
          onClick={() => onChange(o.value)}>
          {o.label ?? t(o.labelKey)}
        </button>
      ))}
    </div>
  );
}

export default function ExportDialog({ open, sessionIds, onClose, onExported }) {
  // ModalBase renders nothing while closed, so the form remounts and reloads saved options on every open
  return (
    <ModalBase open={open} onClose={onClose}>
      <ExportForm sessionIds={sessionIds} onClose={onClose} onExported={onExported} />
    </ModalBase>
  );
}

function ExportForm({ sessionIds, onClose, onExported }) {
  const { t, lang } = useI18n();
  const [opts, setOpts] = useState(loadOptions);
  const set = (key, value) => setOpts((o) => ({ ...o, [key]: value }));

  const handleExport = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(opts));
    downloadFile(getExportUrl(sessionIds, { ...opts, lang }));
    onClose();
    onExported?.();
  };

  return (
    <>
      <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 mb-4">{t("exportTitle")}</h3>
      {sessionIds.length > 1 && (
        <p className="text-xs text-gray-500 dark:text-gray-400 -mt-3 mb-4">{t("exportMultiHint", { count: sessionIds.length })}</p>
      )}

      <div className="flex flex-col gap-4 mb-5">
        <div>
          <span className={lCls}>{t("exportFormat")}</span>
          <ChipGroup options={FORMATS} value={opts.format} onChange={(v) => set("format", v)} t={t} />
        </div>
        <div>
          <span className={lCls}>{t("exportContent")}</span>
          <ChipGroup options={CONTENTS} value={opts.content} onChange={(v) => set("content", v)} t={t} />
        </div>
        <div>
          <span className={lCls}>{t("exportLayout")}</span>
          {/* Plain text has no table form; the server falls back to the chat layout */}
          <ChipGroup options={LAYOUTS} value={opts.format === "txt" ? "chat" : opts.layout}
            onChange={(v) => set("layout", v)} t={t} disabled={opts.format === "txt"} />
        </div>
        <div className="flex flex-col gap-2">
          {TOGGLES.map(({ key, labelKey }) => (
            <label key={key} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
              <input type="checkbox" className="accent-indigo-500 cursor-pointer" checked={opts[key]} onChange={(e) => set(key, e.target.checked)} />
              {t(labelKey)}
            </label>
          ))}
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <button className={btnCancel} onClick={onClose}>{t("cancel")}</button>
        <button className={`${btnPrimary} bg-linear-to-r from-indigo-600 to-cyan-500 text-white shadow-md shadow-indigo-500/20`} onClick={handleExport}>
          📥 {t("export")}
        </button>
      </div>
    </>
  );
}
