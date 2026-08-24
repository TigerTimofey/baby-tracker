import { useState } from "react";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Icon } from "../../components/ui/Icon";
import { useAuthorLabel, useLive, useNow } from "../../data/hooks";
import { listByChild } from "../../data/repo";
import type { Feeding } from "../../data/types";
import { formatClock, formatDuration, formatTime, plural } from "../../lib/time";
import { FeedingEditor } from "./FeedingEditor";
import {
  durationMs,
  endMs,
  feedingsOnDay,
  findActive,
  kindLabel,
  kindShort,
  lastFinished,
  startMs,
} from "./feedingUtils";
import styles from "./FeedingCard.module.css";

const NO_FEEDINGS: Feeding[] = [];
const DAY_MS = 24 * 3600_000;

export function FeedingCard({ childId }: { childId: string }) {
  const now = useNow(1000);
  const author = useAuthorLabel();
  const [editing, setEditing] = useState<Feeding | null>(null);
  const [adding, setAdding] = useState(false);

  const { data } = useLive(
    async () => await listByChild("feedings", childId),
    [childId],
  );
  const feedings = data ?? NO_FEEDINGS;

  const active = findActive(feedings);
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const today = feedingsOnDay(
    feedings,
    dayStart.getTime(),
    dayStart.getTime() + DAY_MS,
  );

  const previous = lastFinished(feedings);
  const totalMl = today.reduce(
    (sum, feeding) => sum + (feeding.amount_ml ?? 0),
    0,
  );

  const addButton = (
    <Button size="sm" variant="ghost" onClick={() => setAdding(true)}>
      <Icon name="plus" size={16} />
      Добавить
    </Button>
  );

  return (
    <>
      <Card title="Кормления" action={addButton}>
        {active && (
          <div className={styles.live}>
            <span className={styles.liveIcon}>
              <Icon name="bottle" size={18} />
            </span>
            <span className={styles.liveText}>
              <span className={styles.liveTitle}>Кормление идёт</span>
              <span className={styles.liveKind}>
                {kindLabel(active.kind)} · с {formatTime(active.start_at)}
                {author(active.created_by) ? ` · ${author(active.created_by)}` : ""}
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
              ? `Последнее кормление ${formatDuration(now - endMs(previous, now))} назад, длилось ${formatDuration(durationMs(previous, now))}`
              : "Записей пока нет. Нажмите «Кормлю», когда начнёте."}
          </p>
        )}

        {today.length > 0 ? (
          <>
            <div className={styles.list}>
              {today.map((feeding) => (
                <button
                  key={feeding.id}
                  type="button"
                  className={styles.row}
                  onClick={() => setEditing(feeding)}
                >
                  <span className={`${styles.time} tnum`}>
                    {formatTime(feeding.start_at)}
                  </span>
                  <span className={styles.kind}>
                    {kindShort(feeding.kind)}
                    {feeding.food ? ` · ${feeding.food}` : ""}
                    {feeding.end_at
                      ? ` · ${formatDuration(durationMs(feeding, now))}`
                      : " · идёт"}
                    {author(feeding.created_by)
                      ? ` · ${author(feeding.created_by)}`
                      : ""}
                  </span>
                  {feeding.amount_ml != null && (
                    <span className={`${styles.amount} tnum`}>
                      {feeding.amount_ml} мл
                    </span>
                  )}
                </button>
              ))}
            </div>
            <p className={styles.empty} style={{ marginTop: 10 }}>
              Сегодня {today.length}{" "}
              {plural(today.length, ["кормление", "кормления", "кормлений"])}
              {totalMl > 0 ? ` · ${totalMl} мл из бутылочки` : ""}
            </p>
          </>
        ) : (
          <p className={styles.empty}>Сегодня кормлений ещё не записано.</p>
        )}
      </Card>

      {adding && (
        <FeedingEditor
          open={adding}
          onClose={() => setAdding(false)}
          childId={childId}
        />
      )}
      {editing && (
        <FeedingEditor
          key={editing.id}
          open
          onClose={() => setEditing(null)}
          childId={childId}
          feeding={editing}
        />
      )}
    </>
  );
}
