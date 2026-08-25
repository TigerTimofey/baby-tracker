import { Donut } from "../../components/ui/Donut";
import { formatDuration, formatHoursMinutes, plural } from "../../lib/time";
import { DAY_MS, type SleepStats } from "./statsUtils";
import styles from "./DayComposition.module.css";

interface DayCompositionProps {
  stats: SleepStats;
}

export function DayComposition({ stats }: DayCompositionProps) {
  const night = stats.avgNightMs;
  const nap = stats.avgNapMs;
  if (night === null || nap === null || stats.daysCounted === 0) return null;

  const awake = Math.max(0, DAY_MS - night - nap);
  const slices = [
    { label: "Ночной сон", value: night, color: "var(--sleep)" },
    { label: "Дневной сон", value: nap, color: "var(--nap)" },
    { label: "Бодрствование", value: awake, color: "var(--big-number)" },
  ].filter((slice) => slice.value > 0);

  return (
    <div className={styles.row}>
      <Donut
        slices={slices}
        size={106}
        center={formatHoursMinutes(night + nap)}
        centerHint="сна"
        ariaLabel={`Сутки в среднем: ночной сон ${formatDuration(night)}, дневной ${formatDuration(nap)}, бодрствование ${formatDuration(awake)}`}
      />

      <ul className={styles.legend}>
        {slices.map((slice) => (
          <li key={slice.label} className={styles.item}>
            <i className={styles.swatch} style={{ background: slice.color }} />
            <span className={styles.label}>{slice.label}</span>
            <span className={`${styles.value} tnum`}>
              {formatHoursMinutes(slice.value)}
            </span>
          </li>
        ))}
        <li className={styles.basis}>
          в среднем по {stats.daysCounted}{" "}
          {plural(stats.daysCounted, ["дню", "дням", "дням"])} с записями
        </li>
      </ul>
    </div>
  );
}
