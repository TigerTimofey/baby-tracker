import { useActiveChild, useLive } from "../data/hooks";
import { listByChild } from "../data/repo";
import type { SleepSession } from "../data/types";
import { SleepHistory } from "../features/sleep/SleepHistory";
import { SleepSummary } from "../features/sleep/SleepSummary";
import { SleepTimerCard } from "../features/sleep/SleepTimerCard";

const NO_SESSIONS: SleepSession[] = [];

export function SleepPage() {
  const { child } = useActiveChild();
  const childId = child?.id;

  const { data } = useLive(
    async () =>
      childId ? await listByChild("sleep_sessions", childId) : NO_SESSIONS,
    [childId],
  );
  const sessions = data ?? NO_SESSIONS;

  if (!child) return null;

  return (
    <>
      <SleepTimerCard child={child} sessions={sessions} />
      <div style={{ marginTop: "var(--gap-4)" }}>
        <SleepSummary child={child} sessions={sessions} />
      </div>
      <SleepHistory childId={child.id} sessions={sessions} />
    </>
  );
}
