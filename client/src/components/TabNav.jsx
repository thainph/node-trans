const TABS = [
  { key: "live", label: "Live" },
  { key: "settings", label: "Settings" },
];

export default function TabNav({ activeTab, onTabChange }) {
  return (
    <nav className="flex gap-1 py-3">
      {TABS.map((t) => (
        <button
          key={t.key}
          className={`border-none px-4 py-1.5 cursor-pointer rounded-xl text-sm font-medium transition-all duration-200 active:scale-95 ${
            activeTab === t.key
              ? "bg-linear-to-r from-indigo-500/15 to-cyan-500/10 dark:from-indigo-500/20 dark:to-cyan-500/10 text-indigo-600 dark:text-cyan-400 shadow-sm"
              : "bg-transparent text-gray-400 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-400 hover:bg-gray-100/50 dark:hover:bg-white/5"
          }`}
          onClick={() => onTabChange(t.key)}
        >
          {t.label}
        </button>
      ))}
    </nav>
  );
}
