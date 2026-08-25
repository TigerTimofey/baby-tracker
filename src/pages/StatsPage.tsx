import { useMemo, useState } from "react";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { Segmented } from "../components/ui/Segmented";
import { useActiveChild, useLive, useNow } from "../data/hooks";
import { listByChild } from "../data/repo";
import type {
  Child,
  Feeding,
  Measurement,
  SleepSession,
} from "../data/types";
import {
  METRICS,
  METRIC_ORDER,
  seriesFor,
} from "../features/growth/growthUtils";
import { Changes } from "../features/stats/Changes";
import { DayComposition } from "../features/stats/DayComposition";
import { buildChanges } from "../features/stats/changesData";
import { DayMap } from "../features/stats/DayMap";
import { SummaryCard } from "../features/stats/SummaryCard";
import { buildSummary } from "../features/stats/summaryData";
import { Facts } from "../features/stats/Facts";
import { SleepBars } from "../features/stats/SleepBars";
import {
  buildTimelines,
  computeSleepStats,
  formatClockMinutes,
  type Period,
} from "../features/stats/statsUtils";
import { bandFor, nightFeedingWord } from "../features/sleep/sleepUtils";
import { ageOf, birthMoment, formatDuration, plural } from "../lib/time";
import styles from "./StatsPage.module.css";

const NO_SESSIONS: SleepSession[] = [];
const NO_MEASUREMENTS: Measurement[] = [];
const NO_FEEDINGS: Feeding[] = [];

export function StatsPage() {
  const { child } = useActiveChild();
  const childId = child?.id;
  const now = useNow(300_000);
  const [period, setPeriod] = useState<Period>("14");

  const { data } = useLive(
    async () =>
      childId ? await listByChild("sleep_sessions", childId) : NO_SESSIONS,
    [childId],
  );
  const sessions = data ?? NO_SESSIONS;

  const { data: measurementData } = useLive(
    async () =>
      childId ? await listByChild("measurements", childId) : NO_MEASUREMENTS,
    [childId],
  );
  const measurements = measurementData ?? NO_MEASUREMENTS;

  const { data: feedingData } = useLive(
    async () => (childId ? await listByChild("feedings", childId) : NO_FEEDINGS),
    [childId],
  );
  const feedings = feedingData ?? NO_FEEDINGS;

  const stats = useMemo(
    () => computeSleepStats(sessions, period, now),
    [sessions, period, now],
  );

  if (!child) return null;

  const age = ageOf(birthMoment(child.birth_date, child.birth_time), new Date(now));
  const band = bandFor(age.totalMonths);
  const daysWithData = stats.days.filter((day) => day.hasData).length;

  const timelines = buildTimelines(sessions, feedings, stats.days, now);
  const changes = buildChanges(stats, feedings, period, now);

  const summary = buildSummary(
    child,
    sessions,
    feedings,
    measurements,
    period,
    now,
  );

  const periods = (
    <div className={styles.periods}>
      <Segmented<Period>
        value={period}
        onChange={setPeriod}
        ariaLabel="Период"
        options={[
          { value: "7", label: "7 дней" },
          { value: "14", label: "14 дней" },
          { value: "30", label: "30 дней" },
        ]}
      />
    </div>
  );

  const sleepReady = daysWithData >= 2;

  const sleepCards = !sleepReady ? (
    <EmptyState
      icon="stats"
      title="По сну сравнивать нечего"
      text={
        daysWithData === 0
          ? "Записей сна за этот период нет. Статистика появится, когда наберётся хотя бы пара дней."
          : "Есть записи всего за один день. Нужно минимум два, иначе средние и сравнения будут врать."
      }
    />
  ) : (
    <>
      <Card title="Из чего состоят сутки">
        <DayComposition stats={stats} />
      </Card>

      <Card title="Сон по дням">
          <SleepBars
            days={stats.days}
            normMinHours={band.sleepMinH}
            avgTotalMs={stats.avgTotalMs}
            daysCounted={stats.daysCounted}
            deltaMs={stats.deltaMs}
          />
          <p className={styles.basis}>
            Столбик — сон, попавший в эти сутки: фиолетовый ночной, зелёный
            дневной. Пунктир — ориентир {band.sleepMinH} ч сна в сутки для
            этого возраста. Сегодняшний день показан бледнее и в средние не
            входит — он ещё не закончился.
            {stats.deltaMs !== null &&
              " Значок справа — насколько изменилось среднее по сравнению с предыдущим таким же отрезком."}
          </p>
        </Card>

        <Card title="Режим суток">
          <DayMap rows={timelines} withFeedings={feedings.length > 0} />
          <p className={styles.basis}>
            Строка — сутки. Фиолетовый — ночной сон, зелёный — дневной,
            точки — кормления.
          </p>
        </Card>

        <Card title="Ночной сон">
          <Facts
            items={[
              {
                label: "Обычно засыпает",
                value:
                  stats.bedtimeMinutes === null
                    ? null
                    : formatClockMinutes(stats.bedtimeMinutes),
                hint: "медиана, а не среднее — одна поздняя ночь её не сдвинет",
              },
              {
                label: "Обычно просыпается",
                value:
                  stats.wakeMinutes === null
                    ? null
                    : formatClockMinutes(stats.wakeMinutes),
              },
              {
                label: "Самая длинная ночь",
                value:
                  stats.longestNightMs === null
                    ? null
                    : formatDuration(stats.longestNightMs),
              },
              {
                label: "Кормлений за ночь",
                value:
                  stats.avgNightFeedings === null
                    ? null
                    : stats.avgNightFeedings.toLocaleString("ru-RU", {
                        maximumFractionDigits: 1,
                      }),
                hint: `в среднем по ${stats.nightsWithFeedingNote} ${plural(
                  stats.nightsWithFeedingNote,
                  ["ночи", "ночам", "ночам"],
                )} с отметкой${
                  stats.nightFeedingKind
                    ? ` · чаще ${nightFeedingWord(stats.nightFeedingKind)}`
                    : ""
                }`,
              },
              {
                label: "Ночей с записями",
                value: stats.nightCount === 0 ? null : String(stats.nightCount),
              },
            ]}
          />
          {stats.nightCount > 0 && stats.nightCount < 3 && (
            <p className={styles.basis}>
              Обычное время засыпания и подъёма появится, когда наберётся хотя
              бы три ночи.
            </p>
          )}
        </Card>

        <Card title="Дневные сны">
          <Facts
            items={[
              {
                label: "Снов за день",
                value:
                  stats.avgNapCount === null
                    ? null
                    : stats.avgNapCount.toLocaleString("ru-RU", {
                        maximumFractionDigits: 1,
                      }),
                hint: `в среднем по ${stats.daysCounted} дн.`,
              },
              {
                label: "Длительность одного",
                value:
                  stats.avgNapDurationMs === null
                    ? null
                    : formatDuration(stats.avgNapDurationMs),
              },
              {
                label: "Всего за день",
                value:
                  stats.avgNapMs === null || stats.avgNapMs === 0
                    ? null
                    : formatDuration(stats.avgNapMs),
              },
            ]}
          />
        </Card>

      <Card title="Бодрствование">
          <Facts
            items={[
              {
                label: "Между снами",
                value:
                  stats.avgWakeWindowMs === null
                    ? null
                    : formatDuration(stats.avgWakeWindowMs),
                hint: `ориентир для ${age.totalMonths} мес — ${
                  band.wakeMin >= 60
                    ? `${(band.wakeMin / 60).toLocaleString("ru-RU")}–${(band.wakeMax / 60).toLocaleString("ru-RU")} ч`
                    : `${band.wakeMin}–${band.wakeMax} мин`
                }`,
              },
              {
                label: "Самый долгий промежуток",
                value:
                  stats.longestWakeWindowMs === null
                    ? null
                    : formatDuration(stats.longestWakeWindowMs),
              },
            ]}
          />
        <p className={styles.basis}>
          Промежутки длиннее 16 часов не учитываются — это пропуск в записях,
          а не бодрствование.
        </p>
      </Card>
    </>
  );

  return (
    <>
      <h1 className="sr-only">Статистика</h1>
      {periods}

      <div className={styles.stack}>
        <Card title={`Итоги ${summary.periodLabel}`}>
          <SummaryCard data={summary} />
        </Card>

        <Card title="Что изменилось">
          <Changes data={changes} />
        </Card>

        {sleepCards}
        <GrowthOverPeriod
          child={child}
          measurements={measurements}
          days={Number(period)}
          now={now}
        />
      </div>
    </>
  );
}

interface GrowthOverPeriodProps {
  child: Child;
  measurements: Measurement[];
  days: number;
  now: number;
}

function GrowthOverPeriod({
  child,
  measurements,
  days,
  now,
}: GrowthOverPeriodProps) {
  const from = now - days * 24 * 3600_000;

  const items = METRIC_ORDER.flatMap((key) => {
    const info = METRICS[key];
    const all = seriesFor(key, child, measurements);
    if (all.length < 2) return [];

    const last = all[all.length - 1];
    if (last.at.getTime() < from) return [];

    const before = [...all]
      .reverse()
      .find((point) => point.at.getTime() <= from);
    const baseline = before ?? all.find((point) => point.at.getTime() >= from);
    if (!baseline || baseline === last) return [];

    const span = Math.max(
      1,
      Math.round((last.at.getTime() - baseline.at.getTime()) / (24 * 3600_000)),
    );

    return [
      {
        label: info.label,
        value: info.formatDelta(last.raw - baseline.raw),
        hint: `за ${span} ${plural(span, ["день", "дня", "дней"])} между измерениями`,
      },
    ];
  });

  if (items.length === 0) return null;

  return (
    <Card title="Прибавки">
      <Facts items={items} />
    </Card>
  );
}
