import { useState, useEffect } from "react";
import { useSocket } from "../../context/SocketContext";
import { fetchSettings, fetchDevices, saveSettings } from "../../utils/api";
import { LANGUAGE_OPTIONS, CONTEXT_PRESETS } from "../../utils/constants";
import { useI18n } from "../../i18n/I18nContext";
import OverlaySettings from "./OverlaySettings";

const selectCls = "bg-white/80 dark:bg-white/5 text-gray-700 dark:text-gray-300 border border-gray-200/50 dark:border-indigo-500/10 px-3 py-2 rounded-xl w-full text-sm outline-none transition-all duration-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 hover:border-gray-300 dark:hover:border-indigo-500/20";
const labelCls = "block text-xs text-gray-400 dark:text-gray-600 mb-1.5 font-medium uppercase tracking-wider";
const cardCls = "bg-white/60 dark:bg-white/3 border border-gray-200/50 dark:border-indigo-500/10 rounded-2xl p-5";
const cardTitleCls = "text-xs font-semibold text-gray-500 dark:text-gray-500 uppercase tracking-wider mb-4";

const UI_LANG_OPTIONS = [
  { value: "en", label: "English" },
  { value: "vi", label: "Tiếng Việt" },
];

export default function SettingsTab({ active }) {
  const { t, lang, setLang } = useI18n();
  const { dispatch } = useSocket();
  const [audioSource, setAudioSource] = useState("mic");
  const [targetLanguage, setTargetLanguage] = useState("vi");
  const [micTargetLanguage, setMicTargetLanguage] = useState("");
  const [systemTargetLanguage, setSystemTargetLanguage] = useState("");
  const [micDeviceIndex, setMicDeviceIndex] = useState("");
  const [systemDeviceIndex, setSystemDeviceIndex] = useState("");
  const [devices, setDevices] = useState([]);
  const [ffmpegAvailable, setFfmpegAvailable] = useState(true);
  const [sonioxApiKey, setSonioxApiKey] = useState("");
  const [defaultContext, setDefaultContext] = useState("none");
  const [defaultCustomContext, setDefaultCustomContext] = useState("");

  useEffect(() => {
    if (!active) return;
    Promise.all([fetchSettings(), fetchDevices()]).then(([settings, devData]) => {
      setDevices(devData.input || []);
      setFfmpegAvailable(devData.ffmpegAvailable !== false);
      setAudioSource(settings.audioSource || "mic");
      setTargetLanguage(settings.targetLanguage || "vi");
      setMicTargetLanguage(settings.micTargetLanguage || "");
      setSystemTargetLanguage(settings.systemTargetLanguage || "");
      setMicDeviceIndex(settings.micDeviceIndex != null ? String(settings.micDeviceIndex) : "");
      setSystemDeviceIndex(settings.systemDeviceIndex != null ? String(settings.systemDeviceIndex) : "");
      setSonioxApiKey(settings.sonioxApiKey || "");
      setDefaultContext(settings.defaultContext || "none");
      setDefaultCustomContext(settings.defaultCustomContext || "");
    }).catch(() => {});
  }, [active]);

  const audioSourceOptions = [
    { value: "mic", label: t("srcMic") },
    { value: "system", label: t("srcSystem") },
    { value: "both", label: t("srcBoth") },
  ];

  const handleSave = async () => {
    try {
      await saveSettings({
        audioSource,
        targetLanguage,
        micTargetLanguage: micTargetLanguage || null,
        systemTargetLanguage: systemTargetLanguage || null,
        micDeviceIndex: micDeviceIndex ? parseInt(micDeviceIndex) : null,
        systemDeviceIndex: systemDeviceIndex ? parseInt(systemDeviceIndex) : null,
        sonioxApiKey: sonioxApiKey || null,
        defaultContext,
        defaultCustomContext: defaultCustomContext || "",
      });
      dispatch({ type: "TOAST", payload: { message: t("saved"), type: "success" } });
      setTimeout(() => dispatch({ type: "TOAST", payload: { message: t("connected"), type: "" } }), 2000);
    } catch {
      dispatch({ type: "TOAST", payload: { message: t("saveFailed"), type: "error" } });
    }
  };

  const showMic = audioSource !== "system";
  const showSystem = audioSource !== "mic";

  return (
    <div className="py-2 space-y-4 max-w-2xl">

      {/* Section: General */}
      <div className={cardCls}>
        <p className={cardTitleCls}>{t("sectionGeneral")}</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>{t("uiLanguage")}</label>
            <select className={selectCls} value={lang} onChange={(e) => setLang(e.target.value)}>
              {UI_LANG_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>{t("sonioxApiKey")}</label>
            <input
              type="password"
              className={selectCls}
              value={sonioxApiKey}
              onChange={(e) => setSonioxApiKey(e.target.value)}
              placeholder={t("enterApiKey")}
            />
            <p className="text-xs text-gray-400 dark:text-gray-600 mt-1">
              {t("getApiKey")}{" "}
              <a href="https://soniox.com" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">
                soniox.com
              </a>
            </p>
          </div>
        </div>
      </div>

      {/* Warnings */}
      {!ffmpegAvailable && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-400">
          <strong>{t("ffmpegNotFound")}</strong> {t("ffmpegInstall")}
          <br />
          <span className="text-xs opacity-75">{t("ffmpegWindows")}</span>
        </div>
      )}
      {ffmpegAvailable && devices.length === 0 && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-4 py-3 text-sm text-yellow-400">
          {t("noDevices")}
        </div>
      )}

      {/* Section: Audio & Translation */}
      <div className={cardCls}>
        <p className={cardTitleCls}>{t("sectionAudio")}</p>
        <div className="grid grid-cols-2 gap-4">

          {/* Audio Source — full width */}
          <div className="col-span-2">
            <label className={labelCls}>{t("audioSource")}</label>
            <select className={`${selectCls} max-w-xs`} value={audioSource} onChange={(e) => setAudioSource(e.target.value)}>
              {audioSourceOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* Mic Device */}
          {showMic && (
            <div>
              <label className={labelCls}>{t("micDevice")}</label>
              <select className={selectCls} value={micDeviceIndex} onChange={(e) => setMicDeviceIndex(e.target.value)}>
                <option value="">{t("none")}</option>
                {devices.map((d) => (
                  <option key={d.index} value={String(d.index)}>[{d.index}] {d.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* System Device */}
          {showSystem && (
            <div>
              <label className={labelCls}>{t("systemDevice")}</label>
              <select className={selectCls} value={systemDeviceIndex} onChange={(e) => setSystemDeviceIndex(e.target.value)}>
                <option value="">{t("autoDetect")}</option>
                {devices.map((d) => (
                  <option key={d.index} value={String(d.index)}>[{d.index}] {d.name}</option>
                ))}
              </select>
              <p className="text-xs text-gray-400 dark:text-gray-600 mt-1">{t("systemDeviceHint")}</p>
            </div>
          )}

          {/* Target Language — pairs with the device above it */}
          <div>
            <label className={labelCls}>
              {audioSource === "both" ? t("micTargetLang") : t("targetLanguage")}
            </label>
            <select
              className={selectCls}
              value={audioSource === "both" ? (micTargetLanguage || targetLanguage) : targetLanguage}
              onChange={(e) => audioSource === "both" ? setMicTargetLanguage(e.target.value) : setTargetLanguage(e.target.value)}
            >
              {LANGUAGE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* System Target Language — only when both */}
          {audioSource === "both" && (
            <div>
              <label className={labelCls}>{t("sysTargetLang")}</label>
              <select className={selectCls} value={systemTargetLanguage || targetLanguage} onChange={(e) => setSystemTargetLanguage(e.target.value)}>
                {LANGUAGE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          )}

        </div>
      </div>

      {/* Section: Default Context */}
      <div className={cardCls}>
        <p className={cardTitleCls}>{t("context")}</p>
        <div className="space-y-3">
          <div>
            <label className={labelCls}>{t("defaultContext")}</label>
            <div className="flex flex-wrap gap-2 items-center">
              <select
                className={`${selectCls} max-w-xs`}
                value={defaultContext}
                onChange={(e) => setDefaultContext(e.target.value)}
              >
                {CONTEXT_PRESETS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              {defaultContext === "custom" && (
                <input
                  className={`${selectCls} flex-1 min-w-[280px]`}
                  placeholder={t("contextPlaceholder")}
                  value={defaultCustomContext}
                  onChange={(e) => setDefaultCustomContext(e.target.value)}
                />
              )}
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-600 mt-1">{t("defaultContextHint")}</p>
          </div>
        </div>
      </div>

      <hr className="border-gray-200/50 dark:border-indigo-500/10" />

      <OverlaySettings />

      {/* Save button */}
      <button
        className="bg-linear-to-r from-indigo-600 to-cyan-500 text-white border-none px-6 py-2.5 rounded-xl cursor-pointer text-sm font-semibold transition-all duration-200 shadow-lg shadow-indigo-500/25 hover:shadow-xl hover:shadow-indigo-500/30 active:scale-95"
        onClick={handleSave}
      >
        {t("saveSettings")}
      </button>
    </div>
  );
}
