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
import { Facts } from "../features/stats/Facts";
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
import { ageOf, birthMoment, formatAge, formatDayLabel, plural } from "../lib/time";
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

  const series = Object.fromEntries(
    METRIC_ORDER.map((key) => [key, seriesFor(key, child, measurements)]),
  ) as Record<WhoMetric, ReturnType<typeof seriesFor>>;

  const anyData = METRIC_ORDER.some((key) => series[key].length > 0);
  const ageDaysNow = ageDaysAt(child, new Date(now));

  const percentileOf = (key: WhoMetric): string | null => {
    const points = series[key];
    if (!points.length || !child.sex) return null;
    const last = points[points.length - 1];
    const z = zScoreFor(key, child.sex, last.ageDays, last.who);
    return z === null ? null : `${formatPercentile(percentileFromZ(z))} перцентиль`;
  };

  const latestOverall = measurements.length
    ? measurements.reduce((newest, item) =>
        item.measured_at > newest.measured_at ? item : newest,
      )
    : null;

  const addButton = (
    <Button size="sm" variant="ghost" onClick={() => setAdding(true)}>
      <Icon name="plus" size={16} />
      Добавить
    </Button>
  );

  const activePoints = series[metric];
  const activeInfo = METRICS[metric];
  const sincePrevious = gainSincePrevious(activePoints);
  const rate = weeklyRate(activePoints);

  return (
    <>
      <h1 className="sr-only">Рост и вес</h1>
      <div className={styles.stack}>
        {!anyData ? (
          <Card title="Рост и вес">
            <p className={styles.intro}>
              Ни одного измерения. Добавьте первое — приложение посчитает
              прибавки и покажет, как малыш идёт относительно норм ВОЗ.
            </p>
            <div className={styles.introAction}>
              <Button variant="primary" onClick={() => setAdding(true)}>
                <Icon name="plus" size={17} />
                Добавить измерение
              </Button>
            </div>
          </Card>
        ) : (
          <>
            <Card title="Последнее измерение" action={addButton}>
              {latestOverall && (
                <p className={styles.when}>
                  {formatDayLabel(latestOverall.measured_at)} ·{" "}
                  {formatAge(
                    ageOf(
                      birthMoment(child.birth_date, child.birth_time),
                      new Date(latestOverall.measured_at),
                    ),
                  )}
                </p>
              )}

              <div className={styles.metrics}>
                {METRIC_ORDER.map((key) => {
                  const points = series[key];
                  if (!points.length) return null;
                  const last = points[points.length - 1];
                  const percentile = percentileOf(key);

                  return (
                    <div key={key} className={styles.metric}>
                      <span>
                        <span className={styles.metricName}>
                          {METRICS[key].label}
                        </span>
                        {percentile && (
                          <span className={styles.metricPercentile}>
                            {percentile}
                          </span>
                        )}
                      </span>
                      <span className={`${styles.metricValue} tnum`}>
                        {METRICS[key].format(last.raw)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </Card>

            <Card title="Динамика">
              <div className={styles.switcher}>
                <Segmented<WhoMetric>
                  value={metric}
                  onChange={setMetric}
                  ariaLabel="Что показать на графике"
                  options={METRIC_ORDER.map((key) => ({
                    value: key,
                    label: METRICS[key].label,
                  }))}
                />
              </div>

              {activePoints.length === 0 ? (
                <p className={styles.intro}>
                  Для этой величины измерений ещё нет.
                </p>
              ) : (
                <>
                  <GrowthChart
                    metric={metric}
                    sex={child.sex}
                    points={activePoints}
                    ageDaysNow={ageDaysNow}
                  />

                  {(sincePrevious || rate !== null) && (
                    <div className={styles.gains}>
                      <Facts
                        items={[
                          {
                            label: "С прошлого измерения",
                            value: sincePrevious
                              ? activeInfo.formatDelta(sincePrevious.deltaRaw)
                              : null,
                            hint: sincePrevious
                              ? `за ${sincePrevious.days} ${plural(sincePrevious.days, ["день", "дня", "дней"])}`
                              : undefined,
                          },
                          {
                            label: "В среднем за неделю",
                            value:
                              rate === null
                                ? null
                                : activeInfo.formatDelta(Math.round(rate)),
                          },
                        ]}
                      />
                    </div>
                  )}

                  {child.sex && (
                    <p className={styles.disclaimer}>
                      Коридоры построены по нормам ВОЗ для{" "}
                      {child.sex === "female" ? "девочек" : "мальчиков"}.
                      Попадание в любую точку коридора — вариант нормы; важна не
                      сама цифра, а то, держится ли ребёнок своей линии.
                      Оценивает это педиатр, а не приложение.
                    </p>
                  )}
                </>
              )}
            </Card>
          </>
        )}

        <Card
          title="История"
          action={measurements.length > 0 ? addButton : undefined}
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
