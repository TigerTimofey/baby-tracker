import { t, withCount } from "../../lib/i18n";
import { useState } from "react";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Digits } from "../../components/ui/Digits";
import { Icon } from "../../components/ui/Icon";
import { useAuthorLabel, useLive, useNow } from "../../data/hooks";
import { listByChild } from "../../data/repo";
import type { Feeding, SleepSession } from "../../data/types";
import {
  formatClock,
  formatDuration,
  formatTime,
} from "../../lib/time";
import { findActive as findActiveSleep } from "../sleep/sleepUtils";
import { FeedingEditor } from "./FeedingEditor";
import {
  durationMs,
  endMs,
  feedingsOnDay,
  findActive,
  kindLabel,
  lastFinished,
  startMs,
} from "./feedingUtils";
import { forecastNextFeeding } from "./forecast";
import styles from "./FeedingCard.module.css";

const NO_FEEDINGS: Feeding[] = [];
const NO_SESSIONS: SleepSession[] = [];
const DAY_MS = 24 * 3600_000;

interface FeedingCardProps {
  childId: string;
  /** Записи сна — чтобы не торопить с кормлением, пока малыш спит. */
  sessions?: SleepSession[];
}

export function FeedingCard({
  childId,
  sessions = NO_SESSIONS,
}: FeedingCardProps) {
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

  // Прогноз только пока кормление не идёт: вместо него на этом месте таймер.
  const forecast = active ? null : forecastNextFeeding(feedings, now);
  const forecastDue = forecast !== null && forecast.at <= now;
  // «Пора кормить» не горит, пока малыш спит: будить ради графика никто не
  // станет, а оранжевая строка всю ночь только раздражала бы. Прогноз на
  // будущее время во сне остаётся — ночью полезно знать, во сколько ждать.
  const sleeping = Boolean(findActiveSleep(sessions));
  const showForecast = forecast !== null && !(forecastDue && sleeping);

  const addButton = (
    <Button size="sm" variant="ghost" onClick={() => setAdding(true)}>
      <Icon name="plus" size={16} />
      {t("Добавить")}
    </Button>
  );

  return (
    <>
      <Card title={t("Кормления")} action={addButton}>
        {active && (
          <div className={styles.live}>
            <span className={styles.liveIcon}>
              <Icon name="bottle" size={18} />
            </span>
            <span className={styles.liveText}>
              <span className={styles.liveTitle}>{t("Кормление идёт")}</span>
              <span className={styles.liveKind}>
                {t("{0} · с {1}", [kindLabel(active.kind), formatTime(active.start_at)])}
                {author(active.created_by) ? ` · ${author(active.created_by)}` : ""}
              </span>
            </span>
            <span className={`${styles.liveTimer} tnum`}>
              {formatClock(now - startMs(active))}
            </span>
          </div>
        )}

        {!active && (
          <div className={styles.now}>
            <p className={styles.summary}>
              {previous
                ? t("Последнее кормление {0} назад, длилось {1}", [formatDuration(now - endMs(previous, now)), formatDuration(durationMs(previous, now))])
                : t("Записей пока нет. Нажмите «Кормлю», когда начнёте.")}
            </p>
            {showForecast && forecast && (
              <>
                <p
                  className={`${styles.hint} ${forecastDue ? styles.hintWarn : ""}`}
                >
                  <Digits>
                    {forecastDue
                      ? t("пора кормить — обычно уже ест")
                      : t("следующее кормление примерно в {0} · через {1}", [
                          formatTime(new Date(forecast.at)),
                          formatDuration(forecast.at - now),
                        ])}
                  </Digits>
                </p>
                <p className={styles.basis}>
                  {t("по {0} последним промежуткам между кормлениями", [
                    forecast.samples,
                  ])}
                </p>
              </>
            )}
          </div>
        )}

        {/* Список за сегодня жил здесь и повторял «Историю кормлений» в другом
            виде. Теперь лента одна, а карточка отвечает только за «что сейчас». */}
        <p className={styles.empty}>
          {today.length > 0
            ? `${t("Сегодня {0}", [withCount(today.length, "кормление")])}${
                totalMl > 0 ? t(" · {0} мл из бутылочки", [totalMl]) : ""
              }`
            : t("Сегодня кормлений ещё не записано.")}
        </p>

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
