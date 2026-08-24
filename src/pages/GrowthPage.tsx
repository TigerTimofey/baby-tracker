import { useState } from "react";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Icon } from "../components/ui/Icon";
import { Segmented } from "../components/ui/Segmented";
import { useActiveChild, useLive, useNow } from "../data/hooks";
import { listByChild } from "../data/repo";
import type { Measurement } from "../data/types";
import { GrowthChart } from "../features/growth/GrowthChart";
import { GrowthHistory } from "../features/growth/GrowthHistory";
import { MeasurementEditor } from "../features/growth/MeasurementEditor";
import {
  METRICS,
  METRIC_ORDER,
  ageDaysAt,
  gainSincePrevious,
  seriesFor,
  weeklyRate,
} from "../features/growth/growthUtils";
import type { WhoMetric } from "../features/growth/whoData";
import {
  formatPercentile,
  percentileFromZ,
  zScoreFor,
} from "../features/growth/whoUtils";
import { formatDate, plural } from "../lib/time";
import styles from "./GrowthPage.module.css";

const NO_MEASUREMENTS: Measurement[] = [];

export function GrowthPage() {
  const { child } = useActiveChild();
  const childId = child?.id;
  const now = useNow(300_000);
  const [metric, setMetric] = useState<WhoMetric>("weight");
  const [adding, setAdding] = useState(false);

  const { data } = useLive(
    async () =>
      childId ? await listByChild("measurements", childId) : NO_MEASUREMENTS,
    [childId],
  );
  const measurements = data ?? NO_MEASUREMENTS;

  if (!child) return null;

  const info = METRICS[metric];
  const points = seriesFor(metric, child, measurements);
  const latest = points.length ? points[points.length - 1] : null;
  const ageDaysNow = ageDaysAt(child, new Date(now));

  const z =
    latest && child.sex
      ? zScoreFor(metric, child.sex, latest.ageDays, latest.who)
      : null;
  const percentile = z === null ? null : percentileFromZ(z);

  const sincePrevious = gainSincePrevious(points);
  const rate = weeklyRate(points);

  const addButton = (
    <Button variant="primary" onClick={() => setAdding(true)}>
      <Icon name="plus" size={17} />
      Добавить
    </Button>
  );

  return (
    <>
      <div className={styles.top}>
        <Segmented<WhoMetric>
          value={metric}
          onChange={setMetric}
          ariaLabel="Что показывать"
          options={METRIC_ORDER.map((key) => ({
            value: key,
            label: METRICS[key].label,
          }))}
        />
      </div>

      <div className={styles.stack}>
        {latest ? (
          <Card title={info.label}>
            <div className={styles.current}>
              <span className={`${styles.value} tnum`}>
                {info.format(latest.raw)}
              </span>
              {percentile !== null && (
                <span className={styles.percentile}>
                  {formatPercentile(percentile)} перцентиль
                </span>
              )}
            </div>

            <p className={styles.meta}>
              измерено {formatDate(latest.at)}
              {percentile !== null &&
                ` · из 100 детей этого возраста ${Math.round(percentile)} имеют ${info.short} меньше`}
            </p>

            {(sincePrevious || rate !== null) && (
              <div className={styles.gains}>
                {sincePrevious && (
                  <div className={styles.gain}>
                    <div className={`${styles.gainValue} tnum`}>
                      {info.formatDelta(sincePrevious.deltaRaw)}
                    </div>
                    <div className={styles.gainLabel}>
                      за {sincePrevious.days}{" "}
                      {plural(sincePrevious.days, ["день", "дня", "дней"])} с
                      прошлого раза
                    </div>
                  </div>
                )}
                {rate !== null && (
                  <div className={styles.gain}>
                    <div className={`${styles.gainValue} tnum`}>
                      {info.formatDelta(Math.round(rate))}
                    </div>
                    <div className={styles.gainLabel}>в среднем за неделю</div>
                  </div>
                )}
              </div>
            )}
          </Card>
        ) : (
          <Card title={info.label}>
            <p className={styles.meta}>
              Ни одного измерения. Добавьте первое — дальше приложение само
              посчитает прибавки и покажет, как малыш идёт относительно норм
              ВОЗ.
            </p>
            <div style={{ marginTop: "var(--gap-4)" }}>{addButton}</div>
          </Card>
        )}

        {points.length > 0 && (
          <Card title="Динамика">
            <GrowthChart
              metric={metric}
              sex={child.sex}
              points={points}
              ageDaysNow={ageDaysNow}
            />
            <p className={styles.disclaimer}>
              Коридоры построены по нормам ВОЗ для {child.sex === "female" ? "девочек" : "мальчиков"}.
              Попадание в любую точку коридора — вариант нормы; важна не сама
              цифра, а то, держится ли ребёнок своей линии. Оценивает это
              педиатр, а не приложение.
            </p>
          </Card>
        )}

        <Card
          title={
            <span className={styles.historyHeader}>
              <span>История</span>
            </span>
          }
          action={
            measurements.length > 0 ? (
              <Button size="sm" variant="ghost" onClick={() => setAdding(true)}>
                <Icon name="plus" size={16} />
                Добавить
              </Button>
            ) : undefined
          }
        >
          <GrowthHistory child={child} measurements={measurements} />
        </Card>
      </div>

      {adding && (
        <MeasurementEditor
          open={adding}
          onClose={() => setAdding(false)}
          childId={child.id}
        />
      )}
    </>
  );
}
