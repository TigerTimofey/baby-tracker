import { HOUR_MS, type DayRow } from "./statsUtils";
import styles from "./DayMap.module.css";

interface DayMapProps {
  rows: DayRow[];
}

const HOUR_MARKS = [0, 6, 12, 18];

export function DayMap({ rows }: DayMapProps) {
  const showEveryLabel = rows.length <= 14;

  return (
    <div>
      <div className={styles.grid}>
        <span />
        {Array.from({ length: 24 }, (_, hour) => (
          <span key={`h-${hour}`} className={styles.hourLabel}>
            {HOUR_MARKS.includes(hour) ? String(hour).padStart(2, "0") : ""}
          </span>
        ))}

        {rows.map((row, index) => (
          <Row
            key={row.day.key}
            row={row}
            showLabel={showEveryLabel || index % 5 === 0 || row.day.isToday}
          />
        ))}
      </div>

      <div className={styles.legend}>
        <span className={styles.legendItem}>
          <i className={`${styles.swatch} ${styles.swatchNight}`} />
          ночной сон
        </span>
        <span className={styles.legendItem}>
          <i className={`${styles.swatch} ${styles.swatchNap}`} />
          дневной
        </span>
        <span className={styles.legendItem}>
          <i className={`${styles.swatch} ${styles.swatchEmpty}`} />
          не спит или нет записи
        </span>
      </div>
    </div>
  );
}

function Row({ row, showLabel }: { row: DayRow; showLabel: boolean }) {
  return (
    <>
      <span
        className={`${styles.dayLabel} ${
          row.day.isToday ? styles.dayLabelToday : ""
        }`}
      >
        {showLabel ? row.day.label : ""}
      </span>

      {row.hours.map((cell, hour) => {
        const filled = cell.nightMs + cell.napMs;
        const share = Math.min(1, filled / HOUR_MS);
        const isNight = cell.nightMs >= cell.napMs;
        const tone = isNight ? "var(--sleep)" : "var(--nap)";

        return (
          <span
            key={`${row.day.key}-${hour}`}
            className={styles.cell}
            style={
              share > 0
                ? {
                    background: `color-mix(in srgb, ${tone} ${Math.round(
                      20 + share * 80,
                    )}%, var(--surface-2))`,
                  }
                : undefined
            }
          />
        );
      })}
    </>
  );
}
