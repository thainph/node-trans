import { useState, lazy, Suspense } from "react";
import { I18nProvider } from "./i18n/I18nContext";
import { SocketProvider, useUI } from "./context/SocketContext";
import { useCommand } from "./hooks/useCommand";
import Toolbar from "./components/Toolbar";
import LiveTab from "./components/live/LiveTab";
import Sidebar from "./components/Sidebar";
import ToastContainer from "./components/Toast";
import StartupCheck from "./components/StartupCheck";

const SettingsModal = lazy(() => import("./components/settings/SettingsTab"));
const OverlayWindow = lazy(() => import("./components/live/OverlayWindow"));

function AppContent() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(() => localStorage.getItem("sidebarOpen") !== "0");
  const { overlayVisible } = useUI();

  const toggleSidebar = () => {
    setSidebarOpen((open) => {
      localStorage.setItem("sidebarOpen", open ? "0" : "1");
      return !open;
    });
  };

  useCommand("settings", () => setSettingsOpen(true));
  useCommand("toggle-sidebar", toggleSidebar);

  return (
    <>
      {/* Floating glass sidebar on the left; content runs edge to edge with the toolbar
          and bottom bar floating over it */}
      <div className="flex h-screen text-label">
        <Sidebar open={sidebarOpen} />
        <main className="relative flex-1 min-w-0 bg-content overflow-hidden">
          <LiveTab />
          <Toolbar
            sidebarOpen={sidebarOpen}
            onToggleSidebar={toggleSidebar}
            onOpenSettings={() => setSettingsOpen(true)}
          />
        </main>
      </div>
      {settingsOpen && (
        <Suspense fallback={null}>
          <SettingsModal onClose={() => setSettingsOpen(false)} />
        </Suspense>
      )}
      {overlayVisible && !window.electronAPI?.isElectron && (
        <Suspense fallback={null}>
          <OverlayWindow />
        </Suspense>
      )}
      <ToastContainer />
      <StartupCheck />
    </>
  );
}

export default function App() {
  return (
    <I18nProvider>
    <SocketProvider>
      <AppContent />
    </SocketProvider>
    </I18nProvider>
  );
}
