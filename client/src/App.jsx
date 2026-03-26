import { useState } from "react";
import { I18nProvider } from "./i18n/I18nContext";
import { SocketProvider } from "./context/SocketContext";
import Header from "./components/Header";
import TabNav from "./components/TabNav";
import LiveTab from "./components/live/LiveTab";
import SettingsTab from "./components/settings/SettingsTab";
import Sidebar from "./components/Sidebar";

export default function App() {
  const [activeTab, setActiveTab] = useState("live");

  return (
    <I18nProvider>
    <SocketProvider>
      <div className="flex h-screen max-w-7xl mx-auto px-5 py-4 bg-[#f0f2f8] dark:bg-[#06070b] text-gray-900 dark:text-gray-200 transition-colors duration-300">
        <Sidebar />
        <div className="flex flex-col flex-1 min-w-0">
          <Header />
          <TabNav activeTab={activeTab} onTabChange={setActiveTab} />
          <div className={`flex-1 overflow-hidden flex-col ${activeTab === "live" ? "flex" : "hidden"}`}>
            <LiveTab />
          </div>
          <div className={`flex-1 overflow-hidden flex-col ${activeTab === "settings" ? "flex" : "hidden"}`}>
            <SettingsTab active={activeTab === "settings"} />
          </div>
        </div>
      </div>
    </SocketProvider>
    </I18nProvider>
  );
}
