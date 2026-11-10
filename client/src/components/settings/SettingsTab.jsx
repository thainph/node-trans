import { useState, useEffect, useRef } from "react";
import { Settings, Captions, Languages, Mic, PictureInPicture2, SlidersHorizontal, CheckCircle2, AlertCircle, XCircle, Loader2 } from "lucide-react";
import { useSocketActions } from "../../context/SocketContext";
import { fetchSettings, fetchDevices, saveSettings, fetchLocalStatus, removeWhisperModel } from "../../utils/api";
import { reportError } from "../../utils/errors";
import { LANGUAGE_OPTIONS, CONTEXT_PRESETS, WHISPER_MODEL_OPTIONS, OLLAMA_MODEL_OPTIONS } from "../../utils/constants";
import { useI18n } from "../../i18n/I18nContext";
import { useTheme } from "../../hooks/useTheme";
import OverlaySettings from "./OverlaySettings";
import { ModalBase, ConfirmDialog } from "../Modal";

const hintCls = "text-[11px] text-label-2 leading-snug";
const linkCls = "text-accent hover:underline";

// Locale labels end with ":" for the old stacked layout; rows don't need it
const strip = (str) => str.replace(/:\s*$/, "");

// Label (+ optional helper text) on the left, control on the right
function Row({ label, hint, children }) {
  return (
    <div className="group-row">
      <div className="min-w-0">
        <div>{label}</div>
        {hint && <div className={`${hintCls} mt-0.5`}>{hint}</div>}
      </div>
      {children && <div className="shrink-0 flex items-center gap-2">{children}</div>}
    </div>
  );
}

// Full-width row for status lines, progress and long controls
function WideRow({ children }) {
  return <div className="group-row flex-col items-stretch! justify-center gap-1.5">{children}</div>;
}

function Status({ state, children }) {
  const icon = {
    ok: <CheckCircle2 size={14} strokeWidth={1.75} className="shrink-0 text-sys-green" />,
    warn: <AlertCircle size={14} strokeWidth={1.75} className="shrink-0 text-sys-orange" />,
    error: <XCircle size={14} strokeWidth={1.75} className="shrink-0 text-sys-red" />,
    busy: <Loader2 size={14} strokeWidth={1.75} className="shrink-0 text-label-2 animate-spin" />,
  }[state];
  return <div className="flex items-center gap-1.5 text-[12px] text-label">{icon}{children}</div>;
}

function ProgressBar({ value }) {
  return (
    <div className="w-full h-1 rounded-full bg-fill-strong overflow-hidden">
      {value != null ? (
        <div className="h-1 rounded-full bg-accent transition-[width] duration-300" style={{ width: `${value}%` }} />
      ) : (
        <div className="h-1 w-full rounded-full bg-accent animate-pulse" />
      )}
    </div>
  );
}

function Segmented({ options, value, onChange }) {
  return (
    <div className="segmented" role="group">
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Group({ title, children }) {
  return (
    <section>
      {title && <h3 className="section-header mb-1.5">{title}</h3>}
      <div className="group-box">{children}</div>
    </section>
  );
}

// Panes whose local-engine rows need the whisper / ollama / diarize status
const LOCAL_STATUS_PANES = ["transcription", "translation", "advanced"];

const UI_LANG_OPTIONS = [
  { value: "en", label: "English" },
  { value: "vi", label: "Tiếng Việt" },
];

export default function SettingsModal({ onClose }) {
  const { t, lang, setLang } = useI18n();
  const { dispatch } = useSocketActions();
  const [themePref, setTheme] = useTheme();
  const [activeTab, setActiveTab] = useState("general");

  const [audioSource, setAudioSource] = useState("mic");
  const [micTargetLanguage, setMicTargetLanguage] = useState("vi");
  const [systemTargetLanguage, setSystemTargetLanguage] = useState("vi");
  const [micWhisperLanguage, setMicWhisperLanguage] = useState("auto");
  const [systemWhisperLanguage, setSystemWhisperLanguage] = useState("auto");
  const [micDeviceIndex, setMicDeviceIndex] = useState("");
  const [systemDeviceIndex, setSystemDeviceIndex] = useState("");
  const [devices, setDevices] = useState([]);
  const [ffmpegAvailable, setFfmpegAvailable] = useState(true);
  const [audiocapAvailable, setAudiocapAvailable] = useState(false);
  const [sonioxApiKey, setSonioxApiKey] = useState("");
  const [transcriptionEngine, setTranscriptionEngine] = useState("soniox");
  const [whisperModel, setWhisperModel] = useState("base");
  const [localTranslationEngine, setLocalTranslationEngine] = useState("none");
  const [ollamaModel, setOllamaModel] = useState("llama3.2");
  const [enableDiarization, setEnableDiarization] = useState(false);
  const [hfToken, setHfToken] = useState("");
  const [whisperStatus, setWhisperStatus] = useState(null);
  const [checkingWhisper, setCheckingWhisper] = useState(false);
  const [ollamaStatus, setOllamaStatus] = useState(null);
  const [checkingOllama, setCheckingOllama] = useState(false);
  const [libreStatus, setLibreStatus] = useState(null);
  const [checkingLibre, setCheckingLibre] = useState(false);
  const [diarizeStatus, setDiarizeStatus] = useState(null);
  const [checkingDiarize, setCheckingDiarize] = useState(false);
  const [defaultContext, setDefaultContext] = useState("none");
  const [defaultCustomContext, setDefaultCustomContext] = useState("");
  const [setupLog, setSetupLog] = useState([]);
  const [setupRunning, setSetupRunning] = useState(false);
  const [setupDone, setSetupDone] = useState(false);
  const [setupError, setSetupError] = useState(null);
  const [setupLogFile, setSetupLogFile] = useState(null);
  const setupLogRef = useRef(null);

  const [confirmRemoveModel, setConfirmRemoveModel] = useState(false);
  const [whisperSetupLog, setWhisperSetupLog] = useState([]);
  const [whisperSetupRunning, setWhisperSetupRunning] = useState(false);
  const [whisperSetupDone, setWhisperSetupDone] = useState(false);
  const [whisperSetupError, setWhisperSetupError] = useState(null);
  const [whisperSetupLogFile, setWhisperSetupLogFile] = useState(null);
  const [whisperDownloadProgress, setWhisperDownloadProgress] = useState(null);
  const whisperSetupLogRef = useRef(null);

  const engineStatusFetched = useRef(false);
  useEffect(() => {
    fetchSettings().then((settings) => {
      setAudioSource(settings.audioSource || "mic");
      const defaultTarget = settings.targetLanguage || "vi";
      setMicTargetLanguage(settings.micTargetLanguage || defaultTarget);
      setSystemTargetLanguage(settings.systemTargetLanguage || defaultTarget);
      setMicWhisperLanguage(settings.micWhisperLanguage || "auto");
      setSystemWhisperLanguage(settings.systemWhisperLanguage || "auto");
      setMicDeviceIndex(settings.micDeviceIndex != null ? String(settings.micDeviceIndex) : "");
      setSystemDeviceIndex(settings.systemDeviceIndex != null ? String(settings.systemDeviceIndex) : "");
      setSonioxApiKey(settings.sonioxApiKey || "");
      setTranscriptionEngine(settings.transcriptionEngine || "soniox");
      setWhisperModel(settings.whisperModel || "base");
      setLocalTranslationEngine(settings.localTranslationEngine || "none");
      const savedModel = settings.ollamaModel || "llama3.2";
      setOllamaModel(OLLAMA_MODEL_OPTIONS.find((o) => o.value === savedModel) ? savedModel : "llama3.2");
      setEnableDiarization(!!settings.enableDiarization);
      setHfToken(settings.hfToken || "");
      setDefaultContext(settings.defaultContext || "none");
      setDefaultCustomContext(settings.defaultCustomContext || "");
    }).catch((err) => reportError(dispatch, err, "errLoadSettings"));
    fetchDevices().then((devData) => {
      setDevices(devData.input || []);
      setFfmpegAvailable(devData.ffmpegAvailable !== false);
      setAudiocapAvailable(!!devData.audiocapAvailable);
    }).catch((err) => reportError(dispatch, err, "errLoadDevices"));
  }, []);

  // Fetch engine status lazily when a pane that shows it is opened with local-whisper
  useEffect(() => {
    if (LOCAL_STATUS_PANES.includes(activeTab) && transcriptionEngine === "local-whisper" && !engineStatusFetched.current) {
      engineStatusFetched.current = true;
      fetchWhisperStatus();
      fetchOllamaStatus();
      fetchLibreStatus();
      fetchDiarizeStatus();
    }
  }, [activeTab, transcriptionEngine]);

  useEffect(() => {
    if (setupLogRef.current) setupLogRef.current.scrollTop = setupLogRef.current.scrollHeight;
  }, [setupLog]);

  useEffect(() => {
    if (whisperSetupLogRef.current) whisperSetupLogRef.current.scrollTop = whisperSetupLogRef.current.scrollHeight;
  }, [whisperSetupLog]);

  const fetchWhisperStatus = (model = whisperModel) => {
    setCheckingWhisper(true);
    fetchLocalStatus("whisper", model)
      .then((data) => { setWhisperStatus(data); setCheckingWhisper(false); })
      .catch((err) => { setCheckingWhisper(false); reportError(dispatch, err, "errEngineStatus"); });
  };

  const fetchOllamaStatus = (model = ollamaModel) => {
    setCheckingOllama(true);
    fetchLocalStatus("ollama", model)
      .then((data) => { setOllamaStatus(data); setCheckingOllama(false); })
      .catch((err) => { setCheckingOllama(false); reportError(dispatch, err, "errEngineStatus"); });
  };

  const fetchLibreStatus = () => {
    setCheckingLibre(true);
    fetchLocalStatus("libretranslate")
      .then((data) => { setLibreStatus(data); setCheckingLibre(false); })
      .catch((err) => { setCheckingLibre(false); reportError(dispatch, err, "errEngineStatus"); });
  };

  const fetchDiarizeStatus = () => {
    setCheckingDiarize(true);
    fetchLocalStatus("diarize")
      .then((data) => { setDiarizeStatus(data); setCheckingDiarize(false); })
      .catch((err) => { setCheckingDiarize(false); reportError(dispatch, err, "errEngineStatus"); });
  };

  const startWhisperSetup = () => {
    if (whisperSetupRunning) return;
    setWhisperSetupLog([]);
    setWhisperSetupRunning(true);
    setWhisperSetupDone(false);
    setWhisperSetupError(null);
    setWhisperSetupLogFile(null);
    setWhisperDownloadProgress(null);
    const es = new EventSource(`/api/local/whisper-setup?model=${encodeURIComponent(whisperModel)}`);
    es.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.line !== undefined) {
        setWhisperSetupLog((prev) => [...prev, data.line]);
      } else if (data.progress !== undefined) {
        setWhisperDownloadProgress(data);
        if (data.done) {
          setWhisperSetupRunning(false);
          setWhisperSetupDone(true);
          setWhisperDownloadProgress({ progress: 100, done: true });
          es.close();
          fetchWhisperStatus();
        }
      } else if (data.done) {
        setWhisperSetupRunning(false);
        setWhisperSetupDone(true);
        es.close();
        fetchWhisperStatus();
      } else if (data.error) {
        setWhisperSetupRunning(false);
        setWhisperSetupError(data.error);
        if (data.logFile) setWhisperSetupLogFile(data.logFile);
        es.close();
      }
    };
    es.onerror = () => {
      if (es.readyState === EventSource.CLOSED) {
        setWhisperSetupRunning(false);
        if (!whisperSetupDone) setWhisperSetupError("Connection lost");
        es.close();
      }
    };
  };

  const startSetup = () => {
    if (setupRunning) return;
    setSetupLog([]);
    setSetupRunning(true);
    setSetupDone(false);
    setSetupError(null);
    setSetupLogFile(null);
    const es = new EventSource("/api/local/diarize-setup");
    es.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.line !== undefined) {
        setSetupLog((prev) => [...prev, data.line]);
      } else if (data.done) {
        setSetupRunning(false);
        setSetupDone(true);
        es.close();
        fetchDiarizeStatus();
      } else if (data.error) {
        setSetupRunning(false);
        setSetupError(data.error);
        if (data.logFile) setSetupLogFile(data.logFile);
        es.close();
      }
    };
    es.onerror = () => {
      if (es.readyState === EventSource.CLOSED) {
        setSetupRunning(false);
        if (!setupDone) setSetupError("Connection lost");
        es.close();
      }
    };
  };

  const handleSave = async () => {
    try {
      await saveSettings({
        audioSource,
        targetLanguage: micTargetLanguage,
        micTargetLanguage,
        systemTargetLanguage,
        micWhisperLanguage,
        systemWhisperLanguage,
        micDeviceIndex: micDeviceIndex ? parseInt(micDeviceIndex) : null,
        systemDeviceIndex: systemDeviceIndex ? parseInt(systemDeviceIndex) : null,
        sonioxApiKey: sonioxApiKey || null,
        transcriptionEngine,
        whisperModel,
        localTranslationEngine,
        ollamaModel,
        enableDiarization,
        hfToken: hfToken || null,
        defaultContext,
        defaultCustomContext: defaultCustomContext || "",
      });
      dispatch({ type: "TOAST", payload: { message: t("saved"), type: "success" } });
      return true;
    } catch (err) {
      reportError(dispatch, err, "errSaveSettings");
      return false;
    }
  };

  const handleDone = async () => {
    if (await handleSave()) onClose();
  };

  const showMic = audioSource !== "system";
  const showSystem = audioSource !== "mic";
  const isLocalWhisper = transcriptionEngine === "local-whisper";

  const selectEngine = (value) => {
    setTranscriptionEngine(value);
    if (value === "local-whisper" && !engineStatusFetched.current) {
      engineStatusFetched.current = true;
      fetchWhisperStatus();
      fetchOllamaStatus();
      fetchLibreStatus();
      fetchDiarizeStatus();
    }
  };

  const PANES = [
    { key: "general",       label: t("sectionGeneral"),            Icon: Settings },
    { key: "transcription", label: t("settingsPaneTranscription"), Icon: Captions },
    { key: "translation",   label: t("sectionTranslation"),        Icon: Languages },
    { key: "audio",         label: t("sectionAudio"),              Icon: Mic },
    { key: "overlay",       label: t("settingsTabOverlay"),        Icon: PictureInPicture2 },
    { key: "advanced",      label: t("settingsPaneAdvanced"),      Icon: SlidersHorizontal },
  ];
  const activePane = PANES.find((p) => p.key === activeTab) ?? PANES[0];

  const languageSelect = (value, onChange, withAuto) => (
    <select className="select w-48" value={value} onChange={(e) => onChange(e.target.value)}>
      {withAuto && <option value="auto">{t("autoDetect")}</option>}
      {LANGUAGE_OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );

  const checking = <Status state="busy">{t("settingsChecking")}</Status>;

  return (
    <>
    <ModalBase
      open
      onClose={onClose}
      closeOnBackdrop={false}
      width={760}
      className="flex flex-col overflow-hidden! h-[min(560px,calc(100vh-80px))]"
    >
      <div className="flex flex-1 min-h-0">
        {/* Pane list */}
        <nav className="w-[190px] shrink-0 flex flex-col gap-0.5 p-2 pt-3 bg-grouped border-r-[0.5px] border-separator overflow-y-auto" aria-label={t("tabSettings")}>
          {PANES.map(({ key, label, Icon }) => (
            <div
              key={key}
              role="button"
              tabIndex={0}
              aria-selected={activeTab === key}
              className="list-row"
              onClick={() => setActiveTab(key)}
              onKeyDown={(e) => {
                if (e.key === " " || e.key === "Enter") { e.preventDefault(); e.stopPropagation(); setActiveTab(key); }
              }}
            >
              <Icon size={14} strokeWidth={1.75} className="shrink-0" />
              <span className="truncate">{label}</span>
            </div>
          ))}
        </nav>

        {/* Pane content */}
        <div className="flex-1 min-w-0 overflow-y-auto px-6 py-5 space-y-5">
          <h2 className="text-[15px] font-semibold text-label">{activePane.label}</h2>

          {/* ── GENERAL ── */}
          {activeTab === "general" && (
            <Group>
              <Row label={strip(t("uiLanguage"))}>
                <select className="select w-40" value={lang} onChange={(e) => setLang(e.target.value)}>
                  {UI_LANG_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </Row>
              <Row label={t("settingsAppearance")}>
                <Segmented
                  value={themePref}
                  onChange={setTheme}
                  options={[
                    { value: "system", label: t("themeSystem") },
                    { value: "light", label: t("themeLight") },
                    { value: "dark", label: t("themeDark") },
                  ]}
                />
              </Row>
            </Group>
          )}

          {/* ── TRANSCRIPTION ── */}
          {activeTab === "transcription" && (
            <>
              <Group>
                <Row label={t("sectionEngine")}>
                  <Segmented
                    value={transcriptionEngine}
                    onChange={selectEngine}
                    options={[
                      { value: "soniox", label: t("engineSoniox") },
                      { value: "local-whisper", label: t("engineLocalWhisper") },
                    ]}
                  />
                </Row>
              </Group>

              {/* Soniox */}
              {!isLocalWhisper && (
                <Group>
                  <WideRow>
                    <div className="flex items-center justify-between gap-3">
                      <span className="shrink-0">{strip(t("sonioxApiKey"))}</span>
                      <input
                        type="password"
                        className="field w-72"
                        value={sonioxApiKey}
                        onChange={(e) => setSonioxApiKey(e.target.value)}
                        placeholder={t("enterApiKey")}
                      />
                    </div>
                    <p className={hintCls}>
                      {t("getApiKey")}{" "}
                      <a href="https://soniox.com" target="_blank" rel="noopener noreferrer" className={linkCls}>soniox.com</a>
                    </p>
                  </WideRow>
                </Group>
              )}

              {/* Local Whisper */}
              {isLocalWhisper && (
                <Group>
                  <Row
                    label={strip(t("whisperModel"))}
                    hint={WHISPER_MODEL_OPTIONS.find((o) => o.value === whisperModel)?.[lang] ?? ""}
                  >
                    <select className="select w-48" value={whisperModel} onChange={(e) => { setWhisperModel(e.target.value); fetchWhisperStatus(e.target.value); setWhisperSetupDone(false); setWhisperDownloadProgress(null); }}>
                      {WHISPER_MODEL_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </Row>

                  {/* Status + setup inline */}
                  {(checkingWhisper || whisperStatus || whisperSetupRunning || whisperSetupError) && (
                    <WideRow>
                      {checkingWhisper ? checking : whisperStatus && (
                        <>
                          {whisperStatus.pythonAvailable === false && !whisperStatus.whisperPyReady && (
                            <Status state="error">
                              <span>{t("pythonNotFound")}</span>
                              <a href="https://www.python.org/downloads/" target="_blank" rel="noopener noreferrer" className={linkCls}>
                                {t("pythonDownloadHint")}
                              </a>
                            </Status>
                          )}
                          <div className="flex items-center justify-between gap-2">
                            <Status state={whisperStatus.whisperPyReady ? "ok" : "warn"}>
                              {t(whisperStatus.whisperPyReady ? "whisperPyReady" : "whisperPyMissing")}
                            </Status>
                            {!whisperStatus.whisperPyReady && !whisperSetupRunning && whisperStatus.pythonAvailable !== false && (
                              <button onClick={startWhisperSetup} className="btn">{t("whisperSetup")}</button>
                            )}
                          </div>
                          {whisperStatus.whisperPyReady && (
                            <div className="flex items-center justify-between gap-2">
                              <Status state={whisperStatus.whisperModelDownloaded ? "ok" : "warn"}>
                                {t(whisperStatus.whisperModelDownloaded ? "whisperModelDownloaded" : "whisperModelNotDownloaded")}
                              </Status>
                              {whisperStatus.whisperModelDownloaded && (
                                <button onClick={() => setConfirmRemoveModel(true)} className="btn text-sys-red">
                                  {t("whisperRemoveModel")}
                                </button>
                              )}
                              {!whisperStatus.whisperModelDownloaded && !whisperSetupRunning && (
                                <button onClick={startWhisperSetup} className="btn">{t("whisperSetup")}</button>
                              )}
                            </div>
                          )}
                        </>
                      )}

                      {whisperSetupRunning && (
                        <div className="space-y-1.5 pt-1">
                          <div className="flex items-center justify-between text-[11px] text-label-2">
                            {whisperDownloadProgress ? (
                              <>
                                <span>{t("whisperDownloadingModel")}…</span>
                                <span className="font-mono tabular-nums">
                                  {whisperDownloadProgress.downloaded != null
                                    ? `${whisperDownloadProgress.downloaded} / ${whisperDownloadProgress.total} MB`
                                    : `${whisperDownloadProgress.progress}%`}
                                </span>
                              </>
                            ) : (
                              <span>{t("whisperSetupRunning")}</span>
                            )}
                          </div>
                          <ProgressBar value={whisperDownloadProgress ? whisperDownloadProgress.progress : null} />
                        </div>
                      )}

                      {whisperSetupError && (
                        <div className="selectable text-[11px] text-sys-red space-y-0.5">
                          <p>{t("whisperSetupError")}: {whisperSetupError}</p>
                          {whisperSetupLogFile && (
                            <p className="text-label-2">Log: {whisperSetupLogFile}</p>
                          )}
                        </div>
                      )}
                    </WideRow>
                  )}
                </Group>
              )}
            </>
          )}

          {/* ── TRANSLATION ── */}
          {activeTab === "translation" && (
            <>
              <Group>
                {showMic && (
                  <Row label={strip(t("micTargetLang"))}>
                    {languageSelect(micTargetLanguage, setMicTargetLanguage, false)}
                  </Row>
                )}
                {showSystem && (
                  <Row label={strip(t("sysTargetLang"))}>
                    {languageSelect(systemTargetLanguage, setSystemTargetLanguage, false)}
                  </Row>
                )}
              </Group>

              {/* Local translation service (Local Whisper only) */}
              {isLocalWhisper && (
                <Group title={t("engineLocalWhisper")}>
                  <Row label={t("enableTranslation")}>
                    <input
                      type="checkbox"
                      className="switch"
                      checked={localTranslationEngine !== "none"}
                      onChange={() => setLocalTranslationEngine(localTranslationEngine === "none" ? "ollama" : "none")}
                    />
                  </Row>

                  {localTranslationEngine !== "none" && (
                    <>
                      <Row label={strip(t("localTranslationEngine"))}>
                        <select
                          className="select w-48"
                          value={localTranslationEngine}
                          onChange={(e) => {
                            setLocalTranslationEngine(e.target.value);
                            if (e.target.value === "ollama") fetchOllamaStatus();
                            else if (e.target.value === "libretranslate") fetchLibreStatus();
                          }}
                        >
                          <option value="ollama">Ollama</option>
                          <option value="libretranslate">LibreTranslate</option>
                        </select>
                      </Row>
                      {(checkingOllama || checkingLibre || (ollamaStatus && localTranslationEngine === "ollama") || (libreStatus && localTranslationEngine === "libretranslate")) && (
                        <WideRow>
                          {checkingOllama || checkingLibre ? checking : (<>
                            {ollamaStatus && localTranslationEngine === "ollama" && (
                              <Status state={ollamaStatus.ollamaAvailable ? "ok" : "warn"}>
                                {ollamaStatus.ollamaAvailable ? t("ollamaRunning") : t(ollamaStatus.platform === "win32" ? "ollamaNotRunningWin" : "ollamaNotRunning")}
                              </Status>
                            )}
                            {libreStatus && localTranslationEngine === "libretranslate" && (
                              <Status state={libreStatus.libreTranslateAvailable ? "ok" : "warn"}>
                                {libreStatus.libreTranslateAvailable ? t("libreTranslateOnline") : t("libreTranslateOffline")}
                              </Status>
                            )}
                          </>)}
                        </WideRow>
                      )}
                      {localTranslationEngine === "ollama" && (
                        <>
                          <Row
                            label={strip(t("ollamaModel"))}
                            hint={OLLAMA_MODEL_OPTIONS.find((o) => o.value === ollamaModel)?.[lang] ?? ""}
                          >
                            <select className="select w-48" value={ollamaModel} onChange={(e) => { setOllamaModel(e.target.value); fetchOllamaStatus(e.target.value); }}>
                              {OLLAMA_MODEL_OPTIONS.map((o) => (
                                <option key={o.value} value={o.value}>{o.label}</option>
                              ))}
                            </select>
                          </Row>
                          {!checkingOllama && ollamaStatus && ollamaStatus.ollamaAvailable && (
                            <WideRow>
                              <Status state={ollamaStatus.ollamaModelReady ? "ok" : "warn"}>
                                <span className="selectable">
                                  {ollamaStatus.ollamaModelReady ? t("ollamaModelReady") : t("ollamaModelMissing", { model: ollamaModel })}
                                </span>
                              </Status>
                            </WideRow>
                          )}
                        </>
                      )}
                    </>
                  )}
                </Group>
              )}

              {/* Default context */}
              <Group title={t("settingsTabContext")}>
                <Row label={strip(t("defaultContext"))} hint={t("defaultContextHint")}>
                  <select
                    className="select w-48"
                    value={defaultContext}
                    onChange={(e) => setDefaultContext(e.target.value)}
                  >
                    {CONTEXT_PRESETS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{t(opt.labelKey)}</option>
                    ))}
                  </select>
                </Row>
                {defaultContext === "custom" && (
                  <WideRow>
                    <label className="text-label">{strip(t("contextCustomLabel"))}</label>
                    <textarea
                      className="field w-full resize-none"
                      rows={4}
                      placeholder={t("contextPlaceholder")}
                      value={defaultCustomContext}
                      onChange={(e) => setDefaultCustomContext(e.target.value)}
                    />
                  </WideRow>
                )}
              </Group>
            </>
          )}

          {/* ── AUDIO ── */}
          {activeTab === "audio" && (
            <>
              {!ffmpegAvailable && (
                <div className="flex gap-2 rounded-[10px] px-3 py-2.5 text-[12px] bg-sys-red/10 border-[0.5px] border-sys-red/30 text-label">
                  <XCircle size={14} strokeWidth={1.75} className="shrink-0 mt-0.5 text-sys-red" />
                  <div>
                    <strong className="font-semibold">{t("ffmpegNotFound")}</strong> {t("ffmpegInstall")}
                    <div className={`${hintCls} mt-0.5`}>{t("ffmpegWindows")}</div>
                  </div>
                </div>
              )}
              {ffmpegAvailable && devices.length === 0 && (
                <div className="flex gap-2 rounded-[10px] px-3 py-2.5 text-[12px] bg-sys-orange/10 border-[0.5px] border-sys-orange/30 text-label">
                  <AlertCircle size={14} strokeWidth={1.75} className="shrink-0 mt-0.5 text-sys-orange" />
                  <span>{t("noDevices")}</span>
                </div>
              )}

              <Group>
                <Row label={strip(t("audioSource"))}>
                  <select className="select w-56" value={audioSource} onChange={(e) => setAudioSource(e.target.value)}>
                    <option value="mic">{t("srcMic")}</option>
                    <option value="system">{t("srcSystem")}</option>
                    <option value="both">{t("srcBoth")}</option>
                  </select>
                </Row>
              </Group>

              {showMic && (
                <Group title={t("srcMic")}>
                  <Row label={strip(t("micDevice"))}>
                    <select className="select w-56" value={micDeviceIndex} onChange={(e) => setMicDeviceIndex(e.target.value)}>
                      <option value="">{t("none")}</option>
                      {devices.map((d) => (
                        <option key={d.index} value={String(d.index)}>[{d.index}] {d.name}</option>
                      ))}
                    </select>
                  </Row>
                  <Row label={strip(t("micSourceLang"))}>
                    {languageSelect(micWhisperLanguage, setMicWhisperLanguage, true)}
                  </Row>
                </Group>
              )}
              {showSystem && (
                <Group title={t("srcSystem")}>
                  <Row label={strip(t("sysSourceLang"))}>
                    {languageSelect(systemWhisperLanguage, setSystemWhisperLanguage, true)}
                  </Row>
                </Group>
              )}
            </>
          )}

          {/* ── OVERLAY ── */}
          {activeTab === "overlay" && <OverlaySettings />}

          {/* ── ADVANCED ── */}
          {activeTab === "advanced" && (
            <>
              {!isLocalWhisper && (
                <p className={hintCls}>{t("settingsDiarizationSonioxNote")}</p>
              )}

              {isLocalWhisper && (
                <Group title={t("sectionDiarization")}>
                  <Row label={t("enableDiarization")} hint={t("diarizationHint")}>
                    <input
                      type="checkbox"
                      className="switch"
                      checked={enableDiarization}
                      onChange={() => setEnableDiarization(!enableDiarization)}
                    />
                  </Row>

                  {enableDiarization && (
                    <WideRow>
                      <div className="flex items-center justify-between gap-3">
                        <span className="shrink-0">{strip(t("hfToken"))}</span>
                        <input
                          type="password"
                          className="field w-72"
                          value={hfToken}
                          onChange={(e) => setHfToken(e.target.value)}
                          placeholder={t("hfTokenPlaceholder")}
                        />
                      </div>
                      <p className={hintCls}>
                        {t("hfTokenHint")}{" "}
                        <a href="https://huggingface.co/settings/tokens" target="_blank" rel="noopener noreferrer" className={linkCls}>
                          huggingface.co/settings/tokens
                        </a>
                        {". "}
                        {t("hfTokenModelAccess")}{" "}
                        <a href="https://huggingface.co/pyannote/speaker-diarization-3.1" target="_blank" rel="noopener noreferrer" className={linkCls}>
                          pyannote/speaker-diarization-3.1
                        </a>
                      </p>
                    </WideRow>
                  )}

                  {enableDiarization && (checkingDiarize || diarizeStatus || setupRunning || setupError) && (
                    <WideRow>
                      {checkingDiarize ? checking : diarizeStatus && (
                        <div className="flex items-center justify-between gap-2">
                          <Status state={diarizeStatus.diarizePyReady ? "ok" : "warn"}>
                            {diarizeStatus.diarizePyReady ? t("diarizePyReady") : t("diarizePyMissing")}
                          </Status>
                          {!diarizeStatus.diarizePyReady && !setupRunning && (
                            <button onClick={startSetup} className="btn">{t("diarizeSetup")}</button>
                          )}
                        </div>
                      )}

                      {setupRunning && (
                        <div className="space-y-1.5 pt-1">
                          <p className="text-[11px] text-label-2">{t("diarizeSetupRunning")}</p>
                          <ProgressBar value={null} />
                        </div>
                      )}

                      {setupError && (
                        <div className="selectable text-[11px] text-sys-red space-y-0.5">
                          <p>{t("diarizeSetupError")}: {setupError}</p>
                          {setupLogFile && (
                            <p className="text-label-2">Log: {setupLogFile}</p>
                          )}
                        </div>
                      )}
                    </WideRow>
                  )}
                </Group>
              )}
            </>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="shrink-0 flex justify-end gap-2 px-4 py-3 border-t-[0.5px] border-separator">
        <button onClick={onClose} className="btn">{t("cancel")}</button>
        <button onClick={handleDone} className="btn btn-primary" data-default>{t("settingsDone")}</button>
      </div>
    </ModalBase>

    <ConfirmDialog
      open={confirmRemoveModel}
      title={t("whisperRemoveModel")}
      message={t("whisperRemoveModelConfirm")}
      confirmColor="red"
      onConfirm={() => {
        setConfirmRemoveModel(false);
        removeWhisperModel(whisperModel)
          .then(() => fetchWhisperStatus())
          .catch((err) => reportError(dispatch, err, "errRemoveModel"));
      }}
      onCancel={() => setConfirmRemoveModel(false)}
    />
    </>
  );
}
