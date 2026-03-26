import { useSocket } from "../context/SocketContext";
import { useI18n } from "../i18n/I18nContext";

const base = "text-xs px-3.5 py-1.5 rounded-full font-medium transition-all duration-300";

const variants = {
  listening: `${base} bg-cyan-100 dark:bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 animate-[pulse-glow_2s_ease-in-out_infinite]`,
  error: `${base} bg-rose-100 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 shadow-[0_0_8px_rgba(244,63,94,0.15)]`,
  success: `${base} bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400`,
  paused: `${base} bg-amber-100 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400`,
  "": `${base} bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-gray-500`,
};

export default function StatusBar() {
  const { state } = useSocket();
  const { t } = useI18n();

  const text = state.statusKey ? t(state.statusKey, state.statusParams) : state.statusText;

  return <div className={variants[state.statusClass] || variants[""]}>{text}</div>;
}
