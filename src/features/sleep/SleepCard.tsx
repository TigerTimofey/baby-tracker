import { useState } from "react";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Icon } from "../../components/ui/Icon";
import { useAuthorLabel, useNow } from "../../data/hooks";
import type { SleepSession } from "../../data/types";
import { formatClock, formatDuration, formatTime, plural } from "../../lib/time";
import { SleepEditor } from "./SleepEditor";
import {
  DAY_MS,
  durationMs,
  endMs,
  findActive,
  kindLabel,
  sleepMsInWindow,
  sortedByStartDesc,
  startMs,
} from "./sleepUtils";
import styles from "../feeding/FeedingCard.module.css";
import own from "./SleepCard.module.css";

/** Пара к карточке кормлений: то же самое, но про сон. */
export function SleepCard({
  childId,
  sessions,
}: {
  childId: string;
  sessions: SleepSession[];
}) {
  const now = useNow(1000);
  const author = useAuthorLabel();
  const [adding, setAdding] = useState(false);

  const active = findActive(sessions);
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const from = dayStart.getTime();

  const today = sortedByStartDesc(sessions).filter((session) => {
    const start = startMs(session);
    return start >= from && start < from + DAY_MS;
  });
  const todayMs = sleepMsInWindow(sessions, from, from + DAY_MS, now);

  const previous = sortedByStartDesc(
    sessions.filter((session) => session.end_at !== null),
  )[0];

  const addButton = (
    <Button size="sm" variant="ghost" onClick={() => setAdding(true)}>
      <Icon name="plus" size={16} />
      Добавить
    </Button>
  );

  return (
    <>
      <Card title="Сон" action={addButton}>
        {active && (
          <div className={`${styles.live} ${own.live}`}>
            <span className={`${styles.liveIcon} ${own.liveIcon}`}>
              <Icon name="moon" size={18} />
            </span>
            <span className={styles.liveText}>
              <span className={`${styles.liveTitle} ${own.liveTitle}`}>
                Спит
              </span>
              <span className={styles.liveKind}>
                {kindLabel(active.kind)} · с {formatTime(active.start_at)}
                {author(active.created_by)
                  ? ` · ${author(active.created_by)}`
                  : ""}
              </span>
            </span>
            <span className={`${styles.liveTimer} tnum`}>
              {formatClock(now - startMs(active))}
            </span>
          </div>
        )}

        {!active && (
          <p className={styles.summary}>
            {previous
              ? `Последний сон ${formatDuration(now - endMs(previous, now))} назад, длился ${formatDuration(durationMs(previous, now))}`
              : "Записей пока нет. Нажмите «Уснул», когда малыш заснёт."}
          </p>
        )}

        <p className={styles.empty}>
          {today.length > 0
            ? `Сегодня ${today.length} ${plural(today.length, ["сон", "сна", "снов"])} · ${formatDuration(todayMs)}`
            : "Сегодня снов ещё не записано."}
        </p>
      </Card>

      {adding && (
        <SleepEditor
          open={adding}
          onClose={() => setAdding(false)}
          childId={childId}
        />
      )}
    </>
  );
}
