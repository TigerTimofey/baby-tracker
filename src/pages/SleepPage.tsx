import { useActiveChild, useLive } from "../data/hooks";
import { listByChild } from "../data/repo";
import type { SleepSession } from "../data/types";
import { FeedingButton } from "../features/feeding/FeedingButton";
import { FeedingCard } from "../features/feeding/FeedingCard";
import { SleepHistory } from "../features/sleep/SleepHistory";
import { DayTimeline } from "../features/timeline/DayTimeline";
import { Card } from "../components/ui/Card";
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
      <h1 className="sr-only">Сон и кормления</h1>
      <SleepTimerCard
        child={child}
        sessions={sessions}
        action={<FeedingButton childId={child.id} />}
      />
      <div style={{ marginTop: "var(--gap-4)" }}>
        <FeedingCard childId={child.id} />
      </div>
      <div style={{ marginTop: "var(--gap-4)" }}>
        <SleepSummary child={child} sessions={sessions} />
      </div>
      <div style={{ marginTop: "var(--gap-4)" }}>
        <Card title="Лента дня">
          <DayTimeline childId={child.id} sessions={sessions} />
        </Card>
      </div>
      <SleepHistory childId={child.id} sessions={sessions} />
    </>
  );
}
