import { t } from "../../lib/i18n";
import { parseISO } from "date-fns";
import { useState } from "react";
import { EmptyState } from "../../components/ui/EmptyState";
import type { Child, Measurement } from "../../data/types";
import { ageOf, birthMoment, formatAge, formatDayLabel } from "../../lib/time";
import { MeasurementEditor } from "./MeasurementEditor";
import { METRICS, METRIC_ORDER, sortedMeasurements } from "./growthUtils";
import styles from "./GrowthHistory.module.css";

interface GrowthHistoryProps {
  child: Child;
  measurements: Measurement[];
}

export function GrowthHistory({ child, measurements }: GrowthHistoryProps) {
  const [editing, setEditing] = useState<Measurement | null>(null);
  const rows = sortedMeasurements(measurements);

  if (rows.length === 0) {
    return (
      <EmptyState
        icon="growth"
        title={t("Измерений пока нет")}
        text={t("Добавьте вес и рост — например, после приёма у педиатра.")}
      />
    );
  }

  return (
    <>
      <div className={styles.list}>
        {rows.map((measurement) => {
          const at = parseISO(measurement.measured_at);
          const parts = ageOf(
            birthMoment(child.birth_date, child.birth_time),
            at,
          );
          const age = parts.totalDays === 0 ? t("при рождении") : formatAge(parts);
          const values = METRIC_ORDER.flatMap((key) => {
            const info = METRICS[key];
            const raw = measurement[info.field];
            return raw == null ? [] : [{ key, text: info.format(raw) }];
          });

          return (
            <button
              key={measurement.id}
              type="button"
              className={styles.row}
              onClick={() => setEditing(measurement)}
            >
              <span className={styles.left}>
                <span className={styles.date}>{formatDayLabel(at)}</span>
                <span className={styles.age}>{age}</span>
                {measurement.note && (
                  <span className={styles.note}>{measurement.note}</span>
                )}
              </span>

              <span className={styles.values}>
                {values.map((item, index) => (
                  <span
                    key={item.key}
                    className={index === 0 ? styles.value : styles.secondary}
                  >
                    {item.text}
                  </span>
                ))}
              </span>
            </button>
          );
        })}
      </div>

      {editing && (
        <MeasurementEditor
          key={editing.id}
          open
          onClose={() => setEditing(null)}
          childId={child.id}
          measurement={editing}
        />
      )}
    </>
  );
}
