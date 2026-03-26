import { useState, useEffect } from "react";
import { useSocket } from "../../context/SocketContext";
import { fetchSettings, fetchDevices, saveSettings } from "../../utils/api";
import { LANGUAGE_OPTIONS } from "../../utils/constants";
import { useI18n } from "../../i18n/I18nContext";

const selectCls = "bg-white/80 dark:bg-white/5 text-gray-700 dark:text-gray-300 border border-gray-200/50 dark:border-indigo-500/10 px-3 py-2 rounded-xl w-full max-w-xs text-sm outline-none transition-all duration-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 hover:border-gray-300 dark:hover:border-indigo-500/20";

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
      });
      dispatch({ type: "TOAST", payload: { message: t("saved"), type: "success" } });
      setTimeout(() => dispatch({ type: "TOAST", payload: { message: t("connected"), type: "" } }), 2000);
    } catch {
      dispatch({ type: "TOAST", payload: { message: t("saveFailed"), type: "error" } });
    }
  };

  return (
    <div className="py-2 space-y-5">
      <div>
        <label className="block text-xs text-gray-400 dark:text-gray-600 mb-1.5 font-medium uppercase tracking-wider">
          {t("uiLanguage")}
        </label>
        <select className={selectCls} value={lang} onChange={(e) => setLang(e.target.value)}>
          {UI_LANG_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs text-gray-400 dark:text-gray-600 mb-1.5 font-medium uppercase tracking-wider">
          {t("sonioxApiKey")}
        </label>
        <input
          type="password"
          className={selectCls}
          value={sonioxApiKey}
          onChange={(e) => setSonioxApiKey(e.target.value)}
          placeholder={t("enterApiKey")}
        />
        <p className="text-xs text-gray-400 dark:text-gray-600 mt-1">
          {t("getApiKey")} <a href="https://soniox.com" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">soniox.com</a>
        </p>
      </div>

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
      <div>
        <label className="block text-xs text-gray-400 dark:text-gray-600 mb-1.5 font-medium uppercase tracking-wider">
          {t("audioSource")}
        </label>
        <select className={selectCls} value={audioSource} onChange={(e) => setAudioSource(e.target.value)}>
          {audioSourceOptions.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs text-gray-400 dark:text-gray-600 mb-1.5 font-medium uppercase tracking-wider">
          {t("micDevice")}
        </label>
        <select className={selectCls} value={micDeviceIndex} onChange={(e) => setMicDeviceIndex(e.target.value)}>
          <option value="">{t("none")}</option>
          {devices.map((d) => (
            <option key={d.index} value={String(d.index)}>[{d.index}] {d.name}</option>
          ))}
        </select>
      </div>

      {(audioSource === "system" || audioSource === "both") && (
        <div>
          <label className="block text-xs text-gray-400 dark:text-gray-600 mb-1.5 font-medium uppercase tracking-wider">
            {t("systemDevice")}
          </label>
          <select className={selectCls} value={systemDeviceIndex} onChange={(e) => setSystemDeviceIndex(e.target.value)}>
            <option value="">{t("autoDetect")}</option>
            {devices.map((d) => (
              <option key={d.index} value={String(d.index)}>[{d.index}] {d.name}</option>
            ))}
          </select>
          <p className="text-xs text-gray-400 dark:text-gray-600 mt-1">
            {t("systemDeviceHint")}
          </p>
        </div>
      )}

      {audioSource === "both" ? (
        <>
          <div>
            <label className="block text-xs text-gray-400 dark:text-gray-600 mb-1.5 font-medium uppercase tracking-wider">
              {t("micTargetLang")}
            </label>
            <select className={selectCls} value={micTargetLanguage || targetLanguage} onChange={(e) => setMicTargetLanguage(e.target.value)}>
              {LANGUAGE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-400 dark:text-gray-600 mb-1.5 font-medium uppercase tracking-wider">
              {t("sysTargetLang")}
            </label>
            <select className={selectCls} value={systemTargetLanguage || targetLanguage} onChange={(e) => setSystemTargetLanguage(e.target.value)}>
              {LANGUAGE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </>
      ) : (
        <div>
          <label className="block text-xs text-gray-400 dark:text-gray-600 mb-1.5 font-medium uppercase tracking-wider">
            {t("targetLanguage")}
          </label>
          <select className={selectCls} value={targetLanguage} onChange={(e) => setTargetLanguage(e.target.value)}>
            {LANGUAGE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      )}

      <button
        className="bg-linear-to-r from-indigo-600 to-cyan-500 text-white border-none px-6 py-2.5 rounded-xl cursor-pointer text-sm font-semibold transition-all duration-200 shadow-lg shadow-indigo-500/25 hover:shadow-xl hover:shadow-indigo-500/30 active:scale-95"
        onClick={handleSave}
      >
        💾 {t("saveSettings")}
      </button>
    </div>
  );
}
