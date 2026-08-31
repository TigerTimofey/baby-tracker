import { t, withCount } from "../../lib/i18n";
import { Card } from "../../components/ui/Card";
import { useNow } from "../../data/hooks";
import type { Child, SleepSession } from "../../data/types";
import {ageOf, birthMoment, formatDuration} from "../../lib/time";
import { bandFor, statsForLast24h } from "./sleepUtils";
import styles from "./SleepSummary.module.css";

interface SleepSummaryProps {
  child: Child;
  sessions: SleepSession[];
}

export function SleepSummary({ child, sessions }: SleepSummaryProps) {
  const now = useNow(30_000);
  const stats = statsForLast24h(sessions, now);

  const age = ageOf(birthMoment(child.birth_date, child.birth_time), new Date(now));
  const band = bandFor(age.totalMonths);

  const scale = band.sleepMaxH * 3600_000;
  const nightPart = Math.min(100, (stats.nightMs / scale) * 100);
  const napPart = Math.min(100 - nightPart, (stats.napMs / scale) * 100);

  const empty = stats.totalMs === 0;

  return (
    <Card title={t("За последние сутки")}>
      <div className={`${styles.total} ${empty ? styles.totalEmpty : ""} tnum`}>
        {empty ? t("Записей пока нет") : formatDuration(stats.totalMs)}
      </div>

      <div className={styles.bar}>
        <div className={styles.night} style={{ width: `${nightPart}%` }} />
        <div className={styles.nap} style={{ width: `${napPart}%` }} />
      </div>

      <div className={styles.legend}>
        <span className={styles.item}>
          <i className={`${styles.dot} ${styles.dotNight}`} />
          {t("ночью")}
          <b className={`${styles.value} tnum`}>
            {stats.nightMs === 0 ? "—" : formatDuration(stats.nightMs)}
          </b>
        </span>
        <span className={styles.item}>
          <i className={`${styles.dot} ${styles.dotNap}`} />
          {t("днём")}
          <b className={`${styles.value} tnum`}>
            {stats.napMs === 0 ? "—" : formatDuration(stats.napMs)}
          </b>
        </span>
      </div>

      <p className={styles.norm}>
        {t("ориентир для {0} мес — {1}–{2} ч в сутки", [
          age.totalMonths,
          band.sleepMinH,
          band.sleepMaxH,
        ])}
        {stats.count > 0 &&
          ` · ${withCount(stats.count, "укладывание")}`}
      </p>
    </Card>
  );
}
