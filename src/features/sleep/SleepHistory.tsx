import { useState } from "react";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { Icon } from "../../components/ui/Icon";
import { useNow } from "../../data/hooks";
import type { SleepSession } from "../../data/types";
import { formatDayLabel, formatDuration, formatTime } from "../../lib/time";
import { SleepEditor } from "./SleepEditor";
import { durationMs, groupByDay } from "./sleepUtils";
import styles from "./SleepHistory.module.css";

interface SleepHistoryProps {
  childId: string;
  sessions: SleepSession[];
}

export function SleepHistory({ childId, sessions }: SleepHistoryProps) {
  const now = useNow(30_000);
  const [editing, setEditing] = useState<SleepSession | null>(null);
  const [adding, setAdding] = useState(false);

  const days = groupByDay(sessions, now);

  return (
    <section className={styles.section}>
      <div className={styles.header}>
        <h2 className={styles.title}>История сна</h2>
        <Button size="sm" variant="ghost" onClick={() => setAdding(true)}>
          <Icon name="plus" size={16} />
          Добавить
        </Button>
      </div>

      {days.length === 0 ? (
        <EmptyState
          icon="moon"
          title="Пока ни одной записи"
          text="Здесь будет история по дням — с итогом сна за каждые сутки."
        />
      ) : (
        days.map((day) => (
          <div key={day.key} className={styles.day}>
            <div className={styles.dayHeader}>
              <span className={styles.dayLabel}>
                {formatDayLabel(day.date)}
              </span>
              <span className={styles.dayTotal}>
                {formatDuration(day.totalMs)}
              </span>
            </div>

            <div className={styles.list}>
              {day.sessions.map((session) => {
                const running = session.end_at === null;
                return (
                  <button
                    key={session.id}
                    type="button"
                    className={styles.row}
                    onClick={() => setEditing(session)}
                  >
                    <span
                      className={`${styles.icon} ${
                        session.kind === "nap" ? styles.nap : ""
                      }`}
                    >
                      <Icon
                        name={session.kind === "night" ? "moon" : "sun"}
                        size={16}
                      />
                    </span>

                    <span className={styles.body}>
                      <span className={styles.range}>
                        {formatTime(session.start_at)} →{" "}
                        {session.end_at ? formatTime(session.end_at) : "сейчас"}
                      </span>
                      {session.note && (
                        <span className={styles.note}>{session.note}</span>
                      )}
                    </span>

                    <span
                      className={`${styles.duration} ${running ? styles.live : ""} tnum`}
                    >
                      {formatDuration(durationMs(session, now))}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))
      )}

      {adding && (
        <SleepEditor
          open={adding}
          onClose={() => setAdding(false)}
          childId={childId}
        />
      )}
      {editing && (
        <SleepEditor
          key={editing.id}
          open
          onClose={() => setEditing(null)}
          childId={childId}
          session={editing}
        />
      )}
    </section>
  );
}
