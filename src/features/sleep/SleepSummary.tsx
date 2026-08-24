import { Card } from "../../components/ui/Card";
import { useNow } from "../../data/hooks";
import type { Child, SleepSession } from "../../data/types";
import { ageOf, birthMoment, formatDuration, withPlural } from "../../lib/time";
import { bandFor, statsForLast24h } from "./sleepUtils";
import styles from "./SleepSummary.module.css";

interface SleepSummaryProps {
  child: Child;
  sessions: SleepSession[];
}

/**
 * Итоги за скользящие сутки.
 *
 * Считаем за последние 24 часа, а не с полуночи: иначе утром счётчик
 * показывал бы почти ноль, хотя малыш только что проспал ночь.
 */
export function SleepSummary({ child, sessions }: SleepSummaryProps) {
  const now = useNow(30_000);
  const stats = statsForLast24h(sessions, now);

  const age = ageOf(birthMoment(child.birth_date, child.birth_time), new Date(now));
  const band = bandFor(age.totalMonths);

  // Вся ширина полосы — верхняя граница нормы для возраста.
  const scale = band.sleepMaxH * 3600_000;
  const nightPart = Math.min(100, (stats.nightMs / scale) * 100);
  const napPart = Math.min(100 - nightPart, (stats.napMs / scale) * 100);

  const empty = stats.totalMs === 0;

  return (
    <Card title="За последние сутки">
      <div className={`${styles.total} ${empty ? styles.totalEmpty : ""} tnum`}>
        {empty ? "Записей пока нет" : formatDuration(stats.totalMs)}
      </div>

      <div className={styles.bar}>
        <div className={styles.night} style={{ width: `${nightPart}%` }} />
        <div className={styles.nap} style={{ width: `${napPart}%` }} />
      </div>

      <div className={styles.legend}>
        <span className={styles.item}>
          <i className={`${styles.dot} ${styles.dotNight}`} />
          ночью
          <b className={`${styles.value} tnum`}>
            {stats.nightMs === 0 ? "—" : formatDuration(stats.nightMs)}
          </b>
        </span>
        <span className={styles.item}>
          <i className={`${styles.dot} ${styles.dotNap}`} />
          днём
          <b className={`${styles.value} tnum`}>
            {stats.napMs === 0 ? "—" : formatDuration(stats.napMs)}
          </b>
        </span>
      </div>

      <p className={styles.norm}>
        ориентир для {age.totalMonths} мес — {band.sleepMinH}–{band.sleepMaxH} ч
        в сутки
        {stats.count > 0 &&
          ` · ${withPlural(stats.count, ["укладывание", "укладывания", "укладываний"])}`}
      </p>
    </Card>
  );
}
