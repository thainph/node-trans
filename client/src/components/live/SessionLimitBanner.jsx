import { useEffect, useRef, useState } from "react";
import { Timer, AlertTriangle, Plus, X } from "lucide-react";
import { useI18n } from "../../i18n/I18nContext";
import { formatDuration, notifyInBackground } from "../../utils/notify";

const ICON = { size: 14, strokeWidth: 1.75 };

/** "ok" | "warn" (inside the warning window) | "over" (past the limit, warn-only mode) */
export function limitPhase(limit, elapsed) {
  if (!limit) return "ok";
  const remaining = limit.limitMs - elapsed;
  if (remaining <= 0) return limit.action === "warn" ? "over" : "warn";
  return remaining <= limit.warnMs ? "warn" : "ok";
}

// Floating banner under the toolbar while a recording nears or passes its duration limit.
// The server enforces auto-stop; this only warns and offers Extend / Stop.
export default function SessionLimitBanner({ limit, elapsed, onExtend, onStop, disabled }) {
  const { t } = useI18n();
  const phase = limitPhase(limit, elapsed);
  const [dismissedFor, setDismissedFor] = useState(null);
  const prevPhase = useRef("ok");

  const remaining = limit ? limit.limitMs - elapsed : 0;
  const limitLabel = limit ? formatDuration(limit.limitMs) : "";
  const autoStop = limit?.action === "stop";

  // System notification on each phase change while the app is in the background
  useEffect(() => {
    if (phase === prevPhase.current) return;
    prevPhase.current = phase;
    // Back under the warning window (extend, new recording): a hidden warning may show again
    if (phase === "ok") setDismissedFor(null);
    if (phase === "warn") {
      const minutes = Math.max(1, Math.ceil(remaining / 60_000));
      notifyInBackground(autoStop ? "limitNotifyStop" : "limitNotifyWarn", { minutes, limit: limitLabel });
    } else if (phase === "over") {
      notifyInBackground("limitNotifyOver", { limit: limitLabel });
    }
  }, [phase]);

  if (phase === "ok") return null;
  // Hiding applies to the warning only, and only until the limit changes (extend)
  if (phase === "warn" && dismissedFor === limit.limitMs) return null;

  const over = phase === "over";
  let title, sub;
  if (over) {
    title = t("limitOverTitle", { limit: limitLabel, over: formatDuration(-remaining) });
    sub = t("limitOverSub");
  } else if (autoStop) {
    title = t("limitStopTitle", { remaining: formatDuration(remaining) });
    sub = t("limitStopSub", { limit: limitLabel });
  } else {
    title = t("limitWarnTitle", { remaining: formatDuration(remaining), limit: limitLabel });
    sub = t("limitWarnSub");
  }

  return (
    <div
      role="status"
      className="glass absolute z-20 top-[58px] left-1/2 -translate-x-1/2 w-[min(560px,calc(100%-24px))] flex flex-wrap items-center gap-2.5 py-2 pr-2 pl-3.5 rounded-[18px] animate-[sheetIn_320ms_cubic-bezier(0.25,1.25,0.45,1)]"
    >
      <span className={`w-[26px] h-[26px] shrink-0 grid place-items-center rounded-full ${over ? "text-sys-red bg-sys-red/15" : "text-sys-orange bg-sys-orange/15"}`}>
        {over ? <AlertTriangle {...ICON} /> : <Timer {...ICON} />}
      </span>
      <div className="flex-1 min-w-[180px]">
        <div className="text-[13px] font-semibold text-label leading-snug tabular-nums">{title}</div>
        <div className="text-[11.5px] text-label-2 leading-snug">{sub}</div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <button className="btn h-6 px-2.5 text-[12px]" disabled={disabled} onClick={onExtend}>
          <Plus size={12} strokeWidth={2} />
          {t("limitExtend")}
        </button>
        <button className={`btn h-6 px-2.5 text-[12px] ${over ? "btn-destructive" : ""}`} disabled={disabled} onClick={onStop}>
          {over ? t("stop") : t("limitStopNow")}
        </button>
        {!over && (
          <button
            className="btn-icon btn-icon-sm"
            onClick={() => setDismissedFor(limit.limitMs)}
            title={t("limitDismiss")}
            aria-label={t("limitDismiss")}
          >
            <X {...ICON} />
          </button>
        )}
      </div>
    </div>
  );
}
