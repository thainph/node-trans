import StatusBar from "./StatusBar";
import { useTheme } from "../hooks/useTheme";
import { useI18n } from "../i18n/I18nContext";

export default function Header() {
  const [theme, toggleTheme] = useTheme();
  const { t } = useI18n();

  return (
    <header className="flex justify-between items-center pb-3 border-b border-gray-200/60 dark:border-indigo-500/10">
      <h1 className="text-xl font-bold tracking-tight">
        <span className="bg-linear-to-r from-indigo-500 via-purple-500 to-cyan-400 bg-clip-text text-transparent">
          Node Trans
        </span>
        <span className="text-xs font-normal text-gray-400 dark:text-gray-600 ml-2">by ThaiNPH</span>
      </h1>
      <div className="flex items-center gap-2.5">
        <StatusBar />
        <button
          className="bg-transparent border-none cursor-pointer text-lg px-2 py-1 rounded-xl transition-all duration-200 hover:bg-gray-100/80 dark:hover:bg-white/5 hover:shadow-sm leading-none"
          onClick={toggleTheme}
          title={t("toggleTheme")}
        >
          {theme === "dark" ? "☀️" : "🌙"}
        </button>
      </div>
    </header>
  );
}
