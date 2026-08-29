import { differenceInCalendarDays, parseISO } from "date-fns";
import { useMemo, useRef, useState } from "react";
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
import { Checkup } from "../features/stats/Checkup";
import { buildCheckup } from "../features/stats/checkupData";
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
const ORDER: Period[] = ["7", "14", "30"];

/** Порог, ниже которого жест считаем случайным дрожанием пальца. */
const SWIPE_PX = 45;
const NO_MEASUREMENTS: Measurement[] = [];
const NO_FEEDINGS: Feeding[] = [];

export function StatsPage() {
  const { child } = useActiveChild();
  const childId = child?.id;
  const now = useNow(300_000);
  const [period, setPeriod] = useState<Period>("7");
  const swipeFrom = useRef<{ x: number; y: number } | null>(null);

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

  const oldest = useMemo(() => {
    const times = [
      ...sessions.map((item) => parseISO(item.start_at).getTime()),
      ...feedings.map((item) => parseISO(item.start_at).getTime()),
    ];
    return times.length === 0 ? null : Math.min(...times);
  }, [sessions, feedings]);

  // Периоды доступны всегда — переключатель не должен менять состав кнопок
  // под руками. Если истории не хватает, честно говорим об этом отдельной
  // строкой, а не подменяем выбор.
  const loaded =
    Boolean(childId) && data !== undefined && feedingData !== undefined;
  // Считаем календарные дни, а не прошедшие сутки: графики группируют записи
  // именно так, и «записи за 9 дней» совпадает с тем, что видно на столбиках.
  const historyDays =
    oldest === null
      ? 0
      : differenceInCalendarDays(new Date(now), new Date(oldest)) + 1;
  const shown = period;
  // Неделя показывается всегда: даже три дня записей — это уже статистика,
  // а пустые места карточки объясняют сами. Предупреждение остаётся для
  // длинных периодов, где короткая история и правда вводила бы в заблуждение.
  const enough =
    !loaded || period === "7" || historyDays >= Number(period);

  const stats = useMemo(
    () => computeSleepStats(sessions, shown, now),
    [sessions, shown, now],
  );

  if (!child) return null;

  const age = ageOf(birthMoment(child.birth_date, child.birth_time), new Date(now));
  const band = bandFor(age.totalMonths);
  const daysWithData = stats.days.filter((day) => day.hasData).length;

  const timelines = buildTimelines(sessions, feedings, stats.days, now);
  const changes = buildChanges(stats, feedings, shown, now);
  const checkup = buildCheckup(child, measurements, stats, age.totalMonths, now);

  const summary = buildSummary(
    child,
    sessions,
    feedings,
    measurements,
    shown,
    now,
  );

  function shift(step: number) {
    const at = ORDER.indexOf(period) + step;
    // По кругу не ходим: на краю свайп просто ничего не делает.
    if (at < 0 || at >= ORDER.length) return;
    setPeriod(ORDER[at]);
  }

  const periods = (
    <div
      className={styles.periods}
      onTouchStart={(event) => {
        const touch = event.touches[0];
        swipeFrom.current = { x: touch.clientX, y: touch.clientY };
      }}
      onTouchEnd={(event) => {
        const from = swipeFrom.current;
        swipeFrom.current = null;
        if (!from) return;

        const touch = event.changedTouches[0];
        const dx = touch.clientX - from.x;
        const dy = touch.clientY - from.y;
        // Вертикальное движение — это прокрутка страницы, не наш жест.
        if (Math.abs(dx) < SWIPE_PX || Math.abs(dy) > Math.abs(dx)) return;

        shift(dx < 0 ? 1 : -1);
      }}
    >
      <Segmented<Period>
        value={shown}
        onChange={setPeriod}
        ariaLabel="Период"
        options={ORDER.map((value) => ({
          value,
          label: `${value} дней`,
        }))}
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
            этого возраста. Бледные столбики в средние не входят: сегодняшний
            день ещё не закончился, а у самого первого дня записей нет
            предыдущей ночи, и его сумма всегда занижена.
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
        {!enough ? (
          <p className={styles.shortage}>
            Данных за {period} дней пока нет. Записи есть только за{" "}
            {historyDays === 0
              ? "нулевой срок"
              : `${historyDays} ${plural(historyDays, ["день", "дня", "дней"])}`}
            {" "}— выберите период покороче.
          </p>
        ) : (
          <>
        <Checkup data={checkup} />

        <Card title={`Итоги ${summary.periodLabel}`} collapsible>
          <SummaryCard data={summary} />
        </Card>

        <Card title="Что изменилось">
          <Changes data={changes} />
        </Card>

        {sleepCards}
        <GrowthOverPeriod
          child={child}
          measurements={measurements}
          days={Number(shown)}
          now={now}
        />
          </>
        )}
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
