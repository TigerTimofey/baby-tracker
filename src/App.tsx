import { useEffect, useSyncExternalStore } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { useActiveChild, useSettings } from "./data/hooks";
import { getSyncStatus, initSync, subscribeSync } from "./data/sync";
import { Onboarding } from "./features/children/Onboarding";
import { AuthGate } from "./features/sync/AuthGate";
import { GrowthPage } from "./pages/GrowthPage";
import { MilestonesPage } from "./pages/MilestonesPage";
import { SettingsPage } from "./pages/SettingsPage";
import { SleepPage } from "./pages/SleepPage";
import { StatsPage } from "./pages/StatsPage";

export default function App() {
  // Автосинхронизация живёт столько же, сколько приложение.
  useEffect(() => initSync(), []);

  const status = useSyncExternalStore(
    subscribeSync,
    getSyncStatus,
    getSyncStatus,
  );
  const settings = useSettings();
  const { children, loading } = useActiveChild();

  // Ещё выясняем, есть ли действующий вход. Показать экран входа сейчас
  // значило бы моргнуть им перед тем, кто на самом деле уже вошёл.
  if (status.state === "checking") return null;

  // Профиль малыша заводится уже внутри аккаунта — тогда записи сразу
  // принадлежат семье и видны обоим родителям.
  const needsAuth = status.state === "signed_out" || status.state === "disabled";
  if (needsAuth && !settings.localOnly) {
    return <AuthGate configured={status.state !== "disabled"} />;
  }

  // Пока читаем локальную базу — не мигаем экраном приветствия.
  if (loading) return null;

  if (children.length === 0) return <Onboarding />;

  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Navigate to="/sleep" replace />} />
        <Route path="sleep" element={<SleepPage />} />
        <Route path="growth" element={<GrowthPage />} />
        <Route path="milestones" element={<MilestonesPage />} />
        <Route path="stats" element={<StatsPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/sleep" replace />} />
    </Routes>
  );
}
