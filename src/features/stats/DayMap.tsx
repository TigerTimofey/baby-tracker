import type { DayTimelineRow } from "./statsUtils";
import styles from "./DayMap.module.css";

const HOURS = [0, 6, 12, 18, 24];
const MIN_SPAN_PERCENT = 0.7;

interface DayMapProps {
  rows: DayTimelineRow[];
  withFeedings: boolean;
}

export function DayMap({ rows, withFeedings }: DayMapProps) {
  const labelEvery = rows.length <= 14;

  return (
    <div>
      <div className={styles.axis}>
        <span />
        <div className={styles.axisTrack}>
          {HOURS.map((hour) => (
            <span
              key={hour}
              className={styles.axisMark}
              style={{
                left: `${(hour / 24) * 100}%`,
                transform:
                  hour === 0
                    ? "none"
                    : hour === 24
                      ? "translateX(-100%)"
                      : "translateX(-50%)",
              }}
            >
              {String(hour % 24).padStart(2, "0")}
            </span>
          ))}
        </div>
      </div>

      {rows.map((row, index) => (
        <div key={row.day.key} className={styles.row}>
          <span
            className={`${styles.dayLabel} ${row.day.isToday ? styles.today : ""}`}
          >
            {labelEvery || index % 5 === 0 || row.day.isToday
              ? row.day.label
              : ""}
          </span>

          <div>
            <div className={styles.sleepLane}>
              {row.sleep.map((span, spanIndex) => (
                <i
                  key={spanIndex}
                  className={span.night ? styles.night : styles.nap}
                  style={{
                    left: `${span.from * 100}%`,
                    width: `${Math.max(MIN_SPAN_PERCENT, (span.to - span.from) * 100)}%`,
                  }}
                />
              ))}
            </div>

            {withFeedings && (
              <div className={styles.feedLane}>
                {row.feedings.map((at, markIndex) => (
                  <i
                    key={markIndex}
                    className={styles.feed}
                    style={{ left: `${at * 100}%` }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      ))}

    </div>
  );
}
