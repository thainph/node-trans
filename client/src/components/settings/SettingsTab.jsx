import { useState, useEffect } from "react";
import { fetchSettings, fetchDevices, saveSettings } from "../../utils/api";
import { LANGUAGE_OPTIONS, AUDIO_SOURCE_OPTIONS } from "../../utils/constants";

const selectCls = "bg-white/80 dark:bg-white/5 text-gray-700 dark:text-gray-300 border border-gray-200/50 dark:border-indigo-500/10 px-3 py-2 rounded-xl w-full max-w-xs text-sm outline-none transition-all duration-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 hover:border-gray-300 dark:hover:border-indigo-500/20";

export default function SettingsTab({ active }) {
  const [audioSource, setAudioSource] = useState("mic");
  const [targetLanguage, setTargetLanguage] = useState("vi");
  const [micTargetLanguage, setMicTargetLanguage] = useState("");
  const [systemTargetLanguage, setSystemTargetLanguage] = useState("");
  const [micDeviceIndex, setMicDeviceIndex] = useState("");
  const [systemDeviceIndex, setSystemDeviceIndex] = useState("");
  const [devices, setDevices] = useState([]);
  const [ffmpegAvailable, setFfmpegAvailable] = useState(true);
  const [saveStatus, setSaveStatus] = useState("");

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
    }).catch(() => {});
  }, [active]);

  const handleSave = async () => {
    try {
      await saveSettings({
        audioSource,
        targetLanguage,
        micTargetLanguage: micTargetLanguage || null,
        systemTargetLanguage: systemTargetLanguage || null,
        micDeviceIndex: micDeviceIndex ? parseInt(micDeviceIndex) : null,
        systemDeviceIndex: systemDeviceIndex ? parseInt(systemDeviceIndex) : null,
      });
      setSaveStatus("Saved!");
      setTimeout(() => setSaveStatus(""), 2000);
    } catch {
      setSaveStatus("Failed to save settings");
    }
  };

  return (
    <div className="py-2 space-y-5">
      {!ffmpegAvailable && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-400">
          <strong>ffmpeg not found.</strong> Install ffmpeg and add it to PATH to use audio features.
          <br />
          <span className="text-xs opacity-75">Windows: download from ffmpeg.org, extract, and add the bin folder to system PATH.</span>
        </div>
      )}
      {ffmpegAvailable && devices.length === 0 && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-4 py-3 text-sm text-yellow-400">
          No audio devices detected. Make sure your audio drivers are installed.
        </div>
      )}
      <div>
        <label className="block text-xs text-gray-400 dark:text-gray-600 mb-1.5 font-medium uppercase tracking-wider">
          Audio Source:
        </label>
        <select className={selectCls} value={audioSource} onChange={(e) => setAudioSource(e.target.value)}>
          {AUDIO_SOURCE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs text-gray-400 dark:text-gray-600 mb-1.5 font-medium uppercase tracking-wider">
          Microphone Device:
        </label>
        <select className={selectCls} value={micDeviceIndex} onChange={(e) => setMicDeviceIndex(e.target.value)}>
          <option value="">-- None --</option>
          {devices.map((d) => (
            <option key={d.index} value={String(d.index)}>[{d.index}] {d.name}</option>
          ))}
        </select>
      </div>

      {(audioSource === "system" || audioSource === "both") && (
        <div>
          <label className="block text-xs text-gray-400 dark:text-gray-600 mb-1.5 font-medium uppercase tracking-wider">
            System Audio Device:
          </label>
          <select className={selectCls} value={systemDeviceIndex} onChange={(e) => setSystemDeviceIndex(e.target.value)}>
            <option value="">-- Auto-detect --</option>
            {devices.map((d) => (
              <option key={d.index} value={String(d.index)}>[{d.index}] {d.name}</option>
            ))}
          </select>
          <p className="text-xs text-gray-400 dark:text-gray-600 mt-1">
            Windows: select Stereo Mix or VB-CABLE input device
          </p>
        </div>
      )}

      {audioSource === "both" ? (
        <>
          <div>
            <label className="block text-xs text-gray-400 dark:text-gray-600 mb-1.5 font-medium uppercase tracking-wider">
              Mic → Target Language:
            </label>
            <select className={selectCls} value={micTargetLanguage || targetLanguage} onChange={(e) => setMicTargetLanguage(e.target.value)}>
              {LANGUAGE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-400 dark:text-gray-600 mb-1.5 font-medium uppercase tracking-wider">
              System Audio → Target Language:
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
            Target Language:
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
        💾 Save Settings
      </button>
      {saveStatus && <div className="mt-2 text-sm text-cyan-400">{saveStatus}</div>}
    </div>
  );
}
