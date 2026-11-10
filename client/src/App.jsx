import { useState, lazy, Suspense } from "react";
import { I18nProvider } from "./i18n/I18nContext";
import { SocketProvider, useSocketActions, useUI } from "./context/SocketContext";
import { useCommand } from "./hooks/useCommand";
import Toolbar from "./components/Toolbar";
import LiveTab from "./components/live/LiveTab";
import Sidebar from "./components/Sidebar";
import ToastContainer from "./components/Toast";
import StartupCheck from "./components/StartupCheck";
import ErrorBoundary, { ErrorFallback } from "./components/ErrorBoundary";
import { ModalBase } from "./components/Modal";
import { useGlobalErrors } from "./hooks/useGlobalErrors";
import { reportError } from "./utils/errors";

const SettingsModal = lazy(() => import("./components/settings/SettingsTab"));
const OverlayWindow = lazy(() => import("./components/live/OverlayWindow"));

function AppContent() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(() => localStorage.getItem("sidebarOpen") !== "0");
  const { overlayVisible } = useUI();
  const { dispatch } = useSocketActions();
  useGlobalErrors();
  // For boundaries with no visible fallback: hide the broken piece, but say why
  const reportCrash = (err) => reportError(dispatch, err, "errUnexpected");

  const toggleSidebar = () => {
    setSidebarOpen((open) => {
      localStorage.setItem("sidebarOpen", open ? "0" : "1");
      return !open;
    });
  };

  const closeSettings = () => setSettingsOpen(false);

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
        // A broken settings pane shows its error in the sheet; the rest of the window keeps working
        <ErrorBoundary
          name="settings"
          renderFallback={(p) => (
            <ModalBase open onClose={closeSettings} width={440} className="flex flex-col p-2">
              <ErrorFallback {...p} variant="inline" onClose={closeSettings} />
            </ModalBase>
          )}
        >
          <Suspense fallback={null}>
            <SettingsModal onClose={closeSettings} />
          </Suspense>
        </ErrorBoundary>
      )}
      {overlayVisible && !window.electronAPI?.isElectron && (
        <ErrorBoundary name="overlay" renderFallback={() => null} onError={reportCrash}>
          <Suspense fallback={null}>
            <OverlayWindow />
          </Suspense>
        </ErrorBoundary>
      )}
      <ToastContainer />
      <ErrorBoundary name="startup-check" renderFallback={() => null} onError={reportCrash}>
        <StartupCheck />
      </ErrorBoundary>
    </>
  );
}

export default function App() {
  return (
    <ErrorBoundary name="app">
      <I18nProvider>
        <SocketProvider>
          <AppContent />
        </SocketProvider>
      </I18nProvider>
    </ErrorBoundary>
  );
}
