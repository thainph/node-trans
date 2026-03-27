import { useI18n } from "../i18n/I18nContext";
import { useSocket } from "../context/SocketContext";

export default function TabNav({ activeTab, onTabChange }) {
  const { t } = useI18n();
  const { state, dispatch } = useSocket();
  const TABS = [
    { key: "live", label: t("tabLive") },
    { key: "settings", label: t("tabSettings") },
  ];

  return (
    <nav className="flex items-center gap-1 py-3">
      {TABS.map((tab) => (
        <button
          key={tab.key}
          className={`border-none px-4 py-1.5 cursor-pointer rounded-xl text-sm font-medium transition-all duration-200 active:scale-95 ${
            activeTab === tab.key
              ? "bg-linear-to-r from-indigo-500/15 to-cyan-500/10 dark:from-indigo-500/20 dark:to-cyan-500/10 text-indigo-600 dark:text-cyan-400 shadow-sm"
              : "bg-transparent text-gray-400 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-400 hover:bg-gray-100/50 dark:hover:bg-white/5"
          }`}
          onClick={() => onTabChange(tab.key)}
        >
          {tab.label}
        </button>
      ))}

      <div className="ml-auto">
        <button
          className={`border-none px-3 py-1.5 cursor-pointer rounded-xl text-sm font-medium transition-all duration-200 active:scale-95 ${
            state.overlayVisible
              ? "bg-linear-to-r from-amber-500/15 to-orange-500/10 dark:from-amber-500/20 dark:to-orange-500/10 text-amber-600 dark:text-amber-400 shadow-sm"
              : "bg-transparent text-gray-400 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-400 hover:bg-gray-100/50 dark:hover:bg-white/5"
          }`}
          onClick={() => {
            if (window.electronAPI?.toggleOverlay) {
              window.electronAPI.toggleOverlay({
                settings: state.overlaySettings,
                utterances: state.utterances.slice(-state.overlaySettings.maxLines),
                partials: state.partialResults,
              });
            }
            dispatch({ type: "TOGGLE_OVERLAY" });
          }}
          title={t("overlay")}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 inline-block align-[-2px] mr-1">
            <path fillRule="evenodd" d="M4.25 2A2.25 2.25 0 0 0 2 4.25v11.5A2.25 2.25 0 0 0 4.25 18h11.5A2.25 2.25 0 0 0 18 15.75V4.25A2.25 2.25 0 0 0 15.75 2H4.25ZM3.5 4.25a.75.75 0 0 1 .75-.75h11.5a.75.75 0 0 1 .75.75v11.5a.75.75 0 0 1-.75.75H4.25a.75.75 0 0 1-.75-.75V4.25Z" clipRule="evenodd" />
            <path d="M5 10.5h10v1H5zM5 13h10v1H5z" />
          </svg>
          {t("overlay")}
        </button>
      </div>
    </nav>
  );
}
