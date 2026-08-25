import { useState } from "react";
import { formatDayLabel, formatDuration } from "../../lib/time";
import { HOUR_MS, type DayBucket } from "./statsUtils";
import styles from "./SleepBars.module.css";

interface SleepBarsProps {
  days: DayBucket[];
  normMinHours: number;
  avgTotalMs: number | null;
  daysCounted: number;
  deltaMs: number | null;
}

const MIN_SCALE_MS = 12 * HOUR_MS;
const HEADROOM = 1.15;

export function SleepBars({
  days,
  normMinHours,
  avgTotalMs,
  daysCounted,
  deltaMs,
}: SleepBarsProps) {
  const [picked, setPicked] = useState<string | null>(null);

  const maxTotal = Math.max(...days.map((day) => day.totalMs), 0);
  const needed = Math.max(maxTotal, normMinHours * HOUR_MS) * HEADROOM;
  const scaleMs = Math.max(
    MIN_SCALE_MS,
    Math.ceil(needed / HOUR_MS) * HOUR_MS,
  );
  const normPercent = ((normMinHours * HOUR_MS) / scaleMs) * 100;

  const selected = days.find((day) => day.key === picked) ?? null;
  const showEveryLabel = days.length <= 14;

  const deltaClass =
    deltaMs === null
      ? ""
      : deltaMs >= 0
        ? styles.deltaUp
        : styles.deltaDown;

  return (
    <div className={styles.wrap}>
      <div className={styles.readout}>
        <div>
          <div className={`${styles.readoutMain} tnum`}>
            {selected
              ? selected.hasData
                ? formatDuration(selected.totalMs)
                : "нет записей"
              : avgTotalMs === null
                ? "нет данных"
                : formatDuration(avgTotalMs)}
          </div>
          <div className={styles.readoutSub}>
            {selected
              ? `${formatDayLabel(selected.date)}${
                  selected.hasData
                    ? ` · ночью ${formatDuration(selected.nightMs)}, днём ${formatDuration(selected.napMs)}`
                    : ""
                }`
              : daysCounted > 0
                ? `в среднем за сутки · по ${daysCounted} дн. с записями`
                : "записей пока нет"}
          </div>
        </div>

        {!selected && deltaMs !== null && (
          <span className={`${styles.delta} ${deltaClass}`}>
            {deltaMs >= 0 ? "+" : "−"}
            {formatDuration(Math.abs(deltaMs))}
          </span>
        )}
      </div>

      <div className={styles.chart}>
        <div className={styles.norm} style={{ bottom: `${normPercent}%` }} />

        <div className={styles.bars}>
          {days.map((day) => {
            const nightPercent = (day.nightMs / scaleMs) * 100;
            const napPercent = (day.napMs / scaleMs) * 100;
            return (
              <button
                key={day.key}
                type="button"
                className={[
                  styles.col,
                  day.isToday ? styles.today : "",
                  picked === day.key ? styles.selected : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => setPicked(picked === day.key ? null : day.key)}
                aria-label={`${formatDayLabel(day.date)}: ${
                  day.hasData ? formatDuration(day.totalMs) : "нет записей"
                }`}
              >
                {day.hasData ? (
                  <>
                    <span
                      className={styles.night}
                      style={{ height: `${nightPercent}%` }}
                    />
                    <span
                      className={styles.nap}
                      style={{ height: `${napPercent}%` }}
                    />
                  </>
                ) : (
                  <span className={styles.empty} />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className={styles.ticks}>
        {days.map((day, index) => (
          <span
            key={day.key}
            className={`${styles.tick} ${day.isToday ? styles.tickToday : ""}`}
          >
            {showEveryLabel || index % 5 === 0 || day.isToday ? day.label : ""}
          </span>
        ))}
      </div>
    </div>
  );
}
