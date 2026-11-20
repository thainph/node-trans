import { useMemo, useState } from "react";
import { Heart } from "lucide-react";
import qrcode from "qrcode-generator";
import { useI18n } from "../i18n/I18nContext";
import { ModalBase } from "./Modal";
import { vietQrPayload } from "../utils/vietqr";

const DONATE = {
  bank: "Vietcombank",
  bankBin: "970436",
  accountNumber: "9981964698",
  holder: "NGUYEN PHUONG THAI",
  note: "DONATE NODETRANS",
};

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

function CopyButton({ text }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  return (
    <button
      className={`btn h-6 px-2.5 text-[12px] ${copied ? "text-sys-green" : ""}`}
      onClick={async () => {
        if (await copyText(text)) {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }
      }}
    >
      {copied ? t("donateCopied") : t("donateCopy")}
    </button>
  );
}

function Row({ label, value, mono, copy }) {
  return (
    <div className="group-row">
      <span className="text-[12px] text-label-2 shrink-0">{label}</span>
      <span className="flex items-center gap-2 min-w-0">
        <span className={`selectable text-[12.5px] font-medium text-right break-all ${mono ? "font-mono tabular-nums" : ""}`}>
          {value}
        </span>
        {copy && <CopyButton text={value} />}
      </span>
    </div>
  );
}

export default function DonateDialog({ open, onClose }) {
  const { t } = useI18n();

  const qrSvg = useMemo(() => {
    const qr = qrcode(0, "M");
    qr.addData(vietQrPayload(DONATE));
    qr.make();
    return qr.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
  }, []);

  return (
    <ModalBase open={open} onClose={onClose} width={380} className="p-5 flex flex-col gap-4">
      <div className="flex gap-3 items-start">
        <div className="w-9 h-9 rounded-[10px] shrink-0 grid place-items-center bg-[#ff2d55] text-white">
          <Heart size={18} strokeWidth={0} fill="currentColor" />
        </div>
        <div className="min-w-0">
          <h3 className="text-[14px] font-semibold text-label">{t("donateTitle")}</h3>
          <p className="text-[12px] text-label-2 leading-snug mt-0.5">{t("donateMessage")}</p>
        </div>
      </div>

      {/* Always on white so banking apps can scan it in dark mode too */}
      <div className="self-center flex flex-col items-center gap-1 rounded-2xl bg-white px-3 pt-3 pb-2 shadow-[0_0_0_0.5px_rgba(0,0,0,0.1)]">
        <div
          className="w-[200px] h-[200px] [&>svg]:w-full [&>svg]:h-full"
          role="img"
          aria-label={t("donateQrAlt")}
          dangerouslySetInnerHTML={{ __html: qrSvg }}
        />
        <div className="text-[10.5px] text-[#555]">
          <b className="text-[#c8102e]">VIETQR</b> · {t("donateScan")}
        </div>
      </div>

      <div className="group-box">
        <Row label={t("donateBank")} value={DONATE.bank} />
        <Row label={t("donateAccount")} value={DONATE.accountNumber} mono copy />
        <Row label={t("donateHolder")} value={DONATE.holder} />
        <Row label={t("donateNote")} value={DONATE.note} mono copy />
      </div>

      <p className="text-[11px] text-label-2 text-center">{t("donateThanks")}</p>

      <div className="flex justify-end">
        <button className="btn btn-primary" onClick={onClose} data-default>{t("donateClose")}</button>
      </div>
    </ModalBase>
  );
}
