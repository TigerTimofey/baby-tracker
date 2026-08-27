import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { Toaster } from "./components/ui/Toaster";
import { useActiveChild, useSettings } from "./data/hooks";
import { clearPendingInvite, getPendingInvite } from "./data/invite";
import { getSyncStatus, initSync, joinFamily, subscribeSync } from "./data/sync";
import { showToast } from "./components/ui/toast";
import { applyTheme } from "./data/settings";
import { ensurePersistentStorageOnce } from "./lib/storage";
import { Onboarding } from "./features/children/Onboarding";
import { AuthGate } from "./features/sync/AuthGate";
import { GrowthPage } from "./pages/GrowthPage";
import { IllnessPage } from "./pages/IllnessPage";
import { SettingsPage } from "./pages/SettingsPage";
import { SleepPage } from "./pages/SleepPage";
import { StatsPage } from "./pages/StatsPage";

export default function App() {
  useEffect(() => initSync(), []);
  useEffect(() => {
    void ensurePersistentStorageOnce();
  }, []);

  useEffect(() => {
    const tick = () => applyTheme();
    const timer = setInterval(tick, 30_000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, []);

  const status = useSyncExternalStore(
    subscribeSync,
    getSyncStatus,
    getSyncStatus,
  );
  const settings = useSettings();
  const { children, loading } = useActiveChild();

  const email = status.email;
  useEffect(() => {
    if (!email) return;
    const code = getPendingInvite();
    if (!code) return;

    clearPendingInvite();
    joinFamily(code).then(
      () => showToast("Вы присоединились к семье", undefined, 4000),
      (cause: Error) =>
        showToast(
          `Не удалось присоединиться: ${cause.message}`,
          undefined,
          6000,
        ),
    );
  }, [email]);

  if (status.state === "checking") return null;

  const withToaster = (screen: ReactNode) => (
    <>
      {screen}
      <Toaster />
    </>
  );

  const needsAuth = status.state === "signed_out" || status.state === "disabled";
  if (needsAuth && !settings.localOnly) {
    return withToaster(<AuthGate configured={status.state !== "disabled"} />);
  }

  if (loading) return null;

  if (children.length === 0) return withToaster(<Onboarding />);

  return withToaster(
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Navigate to="/sleep" replace />} />
        <Route path="sleep" element={<SleepPage />} />
        <Route path="growth" element={<GrowthPage />} />
        <Route path="illness" element={<IllnessPage />} />
        <Route path="stats" element={<StatsPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/sleep" replace />} />
    </Routes>,
  );
}
