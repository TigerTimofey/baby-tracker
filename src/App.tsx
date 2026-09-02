import { t } from "./lib/i18n";
import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { Toaster } from "./components/ui/Toaster";
import { useActiveChild, useSettings } from "./data/hooks";
import { clearPendingInvite, getPendingInvite } from "./data/invite";
import { getSyncStatus, initSync, joinFamily, subscribeSync } from "./data/sync";
import { showToast } from "./components/ui/toast";
import { applyLang, applyTheme } from "./data/settings";
import { ensurePersistentStorageOnce } from "./lib/storage";
import { PUSH_CHANGED, refreshPush } from "./lib/push";
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

  useEffect(() => applyLang(), []);

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

  /**
   * Подписку на уведомления перезаписываем при каждом входе в приложение и по
   * сигналу от service worker: браузер меняет её адрес сам, и без этого
   * напоминания однажды прекращаются без всякого признака.
   */
  useEffect(() => {
    if (status.state === "checking" || status.state === "signed_out") return;
    void refreshPush(status.familyId);
  }, [status.state, status.familyId]);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const onMessage = (event: MessageEvent) => {
      const data = event.data as { type?: string } | null;
      if (data?.type === PUSH_CHANGED) void refreshPush(getSyncStatus().familyId);
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () =>
      navigator.serviceWorker.removeEventListener("message", onMessage);
  }, []);
  const settings = useSettings();
  const { children, loading } = useActiveChild();

  const email = status.email;
  useEffect(() => {
    if (!email) return;
    const code = getPendingInvite();
    if (!code) return;

    clearPendingInvite();
    joinFamily(code).then(
      () => showToast(t("Вы присоединились к семье"), undefined, 4000),
      (cause: Error) =>
        showToast(
          t("Не удалось присоединиться: {0}", [cause.message]),
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
