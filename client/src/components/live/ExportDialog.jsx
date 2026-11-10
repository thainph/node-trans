import { useState } from "react";
import { useI18n } from "../../i18n/I18nContext";
import { getExportUrl, downloadFile } from "../../utils/api";
import { ModalBase } from "../Modal";

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

function loadOptions() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") };
  } catch {
    return DEFAULTS;
  }
}

function Segmented({ options, value, onChange, t, disabled }) {
  return (
    <div className="segmented" role="group">
      {options.map((o) => (
        <button key={o.value} type="button" disabled={disabled} aria-pressed={value === o.value}
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
    <ModalBase open={open} onClose={onClose} width={460}>
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
    <div className="p-5">
      <h3 className="text-[13px] font-semibold text-label">{t("exportTitle")}</h3>
      {sessionIds.length > 1 && (
        <p className="text-[11px] text-label-2 mt-1">{t("exportMultiHint", { count: sessionIds.length })}</p>
      )}

      <div className="group-box mt-4">
        <div className="group-row">
          <span>{t("exportFormat")}</span>
          <Segmented options={FORMATS} value={opts.format} onChange={(v) => set("format", v)} t={t} />
        </div>
        <div className="group-row">
          <span>{t("exportContent")}</span>
          <select className="select" value={opts.content} onChange={(e) => set("content", e.target.value)}>
            {CONTENTS.map((o) => <option key={o.value} value={o.value}>{t(o.labelKey)}</option>)}
          </select>
        </div>
        <div className="group-row">
          <span>{t("exportLayout")}</span>
          {/* Plain text has no table form; the server falls back to the chat layout */}
          <Segmented options={LAYOUTS} value={opts.format === "txt" ? "chat" : opts.layout}
            onChange={(v) => set("layout", v)} t={t} disabled={opts.format === "txt"} />
        </div>
      </div>

      <div className="group-box mt-3">
        {TOGGLES.map(({ key, labelKey }) => (
          <label key={key} className="group-row">
            <span>{t(labelKey)}</span>
            <input type="checkbox" className="switch" checked={opts[key]} onChange={(e) => set(key, e.target.checked)} />
          </label>
        ))}
      </div>

      <div className="flex justify-end gap-2 mt-5">
        <button className="btn" onClick={onClose}>{t("cancel")}</button>
        <button className="btn btn-primary" onClick={handleExport} data-default>
          {t("export")}
        </button>
      </div>
    </div>
  );
}
