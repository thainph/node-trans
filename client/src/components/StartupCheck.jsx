import { useState, useEffect, useRef } from "react";
import { AudioLines, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { useI18n } from "../i18n/I18nContext";
import { ModalBase } from "./Modal";

const ITEM_LABEL = {
  whisper: "startupMissingWhisper",
  "whisper-model": "startupMissingWhisperModel",
  diarize: "startupMissingDiarize",
  ollama: "startupMissingOllama",
};

function StatusIcon({ state }) {
  if (state === "done") return <CheckCircle2 size={16} strokeWidth={1.75} className="shrink-0 text-sys-green" />;
  if (state === "running") return <Loader2 size={16} strokeWidth={1.75} className="shrink-0 text-label-2 animate-spin" />;
  return <XCircle size={16} strokeWidth={1.75} className="shrink-0 text-sys-red" />;
}

export default function StartupCheck() {
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);
  const [missing, setMissing] = useState([]); // ["whisper", "diarize", "ollama"]
  const [installing, setInstalling] = useState(false);
  const [log, setLog] = useState([]);
  const [progress, setProgress] = useState(null); // { progress, downloaded, total }
  const [step, setStep] = useState(""); // current install step label
  const [done, setDone] = useState(false);
  const [error, setError] = useState(null);
  const [current, setCurrent] = useState(null); // missing item being installed
  const [completed, setCompleted] = useState([]); // missing items installed so far
  const logRef = useRef(null);
  const checked = useRef(false);

  // Settings cache for checks
  const settingsRef = useRef(null);

  useEffect(() => {
    if (checked.current) return;
    checked.current = true;

    fetch("/api/settings", { cache: "no-store" })
      .then((r) => r.json())
      .then(async (settings) => {
        if (settings.transcriptionEngine !== "local-whisper") return;
        settingsRef.current = settings;

        const model = settings.whisperModel || "base";
        const checks = await Promise.all([
          fetch(`/api/local/status/whisper?model=${encodeURIComponent(model)}`).then((r) => r.json()).catch(() => null),
          settings.enableDiarization && settings.hfToken
            ? fetch("/api/local/status/diarize").then((r) => r.json()).catch(() => null)
            : null,
          settings.localTranslationEngine === "ollama"
            ? fetch(`/api/local/status/ollama?model=${encodeURIComponent(settings.ollamaModel || "")}`).then((r) => r.json()).catch(() => null)
            : null,
        ]);

        const [whisper, diarize, ollama] = checks;
        const needs = [];

        if (!whisper?.whisperPyReady) needs.push("whisper");
        else if (!whisper?.whisperModelDownloaded) needs.push("whisper-model");
        if (diarize && !diarize.diarizePyReady) needs.push("diarize");
        if (ollama && !ollama.ollamaAvailable) needs.push("ollama");

        if (needs.length > 0) {
          setMissing(needs);
          setVisible(true);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [log]);

  const startInstall = async () => {
    setInstalling(true);
    setError(null);
    setLog([]);
    setCompleted([]);

    const settings = settingsRef.current;
    const model = settings?.whisperModel || "base";
    const steps = [...missing]; // copy

    for (const s of steps) {
      if (s === "ollama") continue; // can't auto-install ollama

      const label = s === "whisper" || s === "whisper-model"
        ? t("startupStepWhisper") : t("startupStepDiarize");
      setStep(label);
      setCurrent(s);
      setProgress(null);

      const url = s === "whisper" || s === "whisper-model"
        ? `/api/local/whisper-setup?model=${encodeURIComponent(model)}`
        : "/api/local/diarize-setup";

      const ok = await new Promise((resolve) => {
        const es = new EventSource(url);
        es.onmessage = (e) => {
          const data = JSON.parse(e.data);
          if (data.line !== undefined) {
            setLog((prev) => [...prev, data.line]);
          } else if (data.progress !== undefined) {
            setProgress(data);
            if (data.done) { es.close(); resolve(true); }
          } else if (data.done) {
            es.close();
            resolve(true);
          } else if (data.error) {
            setError(data.error);
            es.close();
            resolve(false);
          }
        };
        es.onerror = () => {
          es.close();
          setError("Connection lost");
          resolve(false);
        };
      });

      if (!ok) { setInstalling(false); setCurrent(null); return; }
      setCompleted((prev) => [...prev, s]);
    }

    setStep("");
    setCurrent(null);
    setDone(true);
    setInstalling(false);
  };

  if (!visible) return null;

  const hasOllamaOnly = missing.length === 1 && missing[0] === "ollama";
  const installable = missing.filter((m) => m !== "ollama");

  const itemState = (m) => {
    if (completed.includes(m) || (done && m !== "ollama")) return "done";
    if (m === current) return "running";
    return "missing";
  };

  return (
    <ModalBase open={visible} onClose={installing ? () => {} : () => setVisible(false)} width={420} className="p-5" closeOnBackdrop={false}>
      <div className="flex items-start gap-3.5">
        <div className="shrink-0 w-12 h-12 rounded-[12px] bg-accent/15 text-accent flex items-center justify-center">
          <AudioLines size={26} strokeWidth={1.75} />
        </div>
        <div className="min-w-0 pt-0.5">
          <h3 className="text-[13px] font-semibold text-label">{t("startupTitle")}</h3>
          <p className="text-[12px] text-label-2 leading-snug mt-1">
            {done ? t("startupDone") : installing ? (step || t("startupInstalling")) : t("startupDesc")}
          </p>
        </div>
      </div>

      <div className="group-box mt-4">
        {missing.map((m) => (
          <div key={m} className="group-row justify-start! min-h-8!">
            <StatusIcon state={itemState(m)} />
            <span className="text-[12px]">{t(ITEM_LABEL[m])}</span>
          </div>
        ))}
      </div>

      {installing && (
        <div className="mt-3 space-y-2">
          <div className="w-full h-1 rounded-full bg-fill-strong overflow-hidden">
            {progress && progress.total > 0 ? (
              <div className="h-1 rounded-full bg-accent transition-[width] duration-300" style={{ width: `${progress.progress}%` }} />
            ) : (
              <div className="h-1 w-full rounded-full bg-accent animate-pulse" />
            )}
          </div>
          {progress && progress.total > 0 && (
            <p className="text-[11px] text-label-2 font-mono tabular-nums">
              {progress.downloaded} / {progress.total} MB
            </p>
          )}
          <div
            ref={logRef}
            className="selectable max-h-32 overflow-y-auto text-[11px] font-mono text-label-2 bg-grouped border-[0.5px] border-separator rounded-md p-2 space-y-px"
          >
            {log.map((line, i) => <div key={i}>{line}</div>)}
          </div>
        </div>
      )}

      {error && !installing && (
        <p className="selectable text-[12px] text-sys-red mt-3">{error}</p>
      )}
      {done && hasOllamaOnly && (
        <p className="text-[12px] text-sys-orange mt-3">{t("startupMissingOllama")}</p>
      )}

      {!installing && (
        <div className="flex justify-end gap-2 mt-5">
          {done ? (
            <button onClick={() => setVisible(false)} className="btn btn-primary" data-default>
              {t("startupClose")}
            </button>
          ) : error ? (
            <>
              <button onClick={() => setVisible(false)} className="btn">{t("startupSkip")}</button>
              <button onClick={() => { setError(null); startInstall(); }} className="btn btn-primary" data-default>
                {t("startupRetry")}
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setVisible(false)} className="btn">{t("startupSkip")}</button>
              {installable.length > 0 && (
                <button onClick={startInstall} className="btn btn-primary" data-default>
                  {t("startupInstall")}
                </button>
              )}
            </>
          )}
        </div>
      )}
    </ModalBase>
  );
}
