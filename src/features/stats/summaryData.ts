import { differenceInCalendarDays, parseISO } from "date-fns";
import type { Child, Feeding, Measurement, SleepSession } from "../../data/types";
import { ageOf, birthMoment, formatAge } from "../../lib/time";
import { METRICS, seriesFor } from "../growth/growthUtils";
import { formatPercentile, percentileFromZ, zScoreFor } from "../growth/whoUtils";
import { computeSleepStats, formatClockMinutes, type Period } from "./statsUtils";

export interface SummaryLine {
  label: string;
  value: string;
  hint?: string;
}

export interface SummaryData {
  childName: string;
  age: string;
  periodLabel: string;
  headline: string;
  headlineHint: string;
  sleep: SummaryLine[];
  feeding: SummaryLine[];
  growth: SummaryLine[];
  madeOn: string;
}

const PERIOD_LABEL: Record<Period, string> = {
  "7": "за неделю",
  "14": "за две недели",
  "30": "за месяц",
};

function hoursAndMinutes(ms: number): string {
  const total = Math.round(ms / 60_000);
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} мин`;
  if (m === 0) return `${h} ч`;
  return `${h} ч ${m} мин`;
}

export function buildSummary(
  child: Child,
  sessions: SleepSession[],
  feedings: Feeding[],
  measurements: Measurement[],
  period: Period,
  now: number,
): SummaryData {
  const days = Number(period);
  const from = now - days * 24 * 3600_000;
  const stats = computeSleepStats(sessions, period, now);
  const age = ageOf(birthMoment(child.birth_date, child.birth_time), new Date(now));

  const sleep: SummaryLine[] = [];
  if (stats.avgTotalMs !== null) {
    sleep.push({
      label: "В сутки в среднем",
      value: hoursAndMinutes(stats.avgTotalMs),
      hint: `по ${stats.daysCounted} дн. с записями`,
    });
  }
  if (stats.avgNightMs !== null && stats.avgNapMs !== null) {
    sleep.push({
      label: "Ночью и днём",
      value: `${hoursAndMinutes(stats.avgNightMs)} + ${hoursAndMinutes(stats.avgNapMs)}`,
    });
  }
  if (stats.bedtimeMinutes !== null && stats.wakeMinutes !== null) {
    sleep.push({
      label: "Обычный режим",
      value: `${formatClockMinutes(stats.bedtimeMinutes)} — ${formatClockMinutes(stats.wakeMinutes)}`,
    });
  }
  if (stats.longestNightMs !== null) {
    sleep.push({
      label: "Самая длинная ночь",
      value: hoursAndMinutes(stats.longestNightMs),
    });
  }

  const inPeriod = feedings.filter(
    (item) => !item.deleted && parseISO(item.start_at).getTime() >= from,
  );
  const nightFeedings = sessions
    .filter(
      (item) =>
        item.kind === "night" &&
        parseISO(item.start_at).getTime() >= from &&
        (item.night_feedings ?? 0) > 0,
    )
    .reduce((sum, item) => sum + (item.night_feedings ?? 0), 0);

  const totalMl = inPeriod.reduce((sum, item) => sum + (item.amount_ml ?? 0), 0);
  const feeding: SummaryLine[] = [];
  if (inPeriod.length > 0) {
    feeding.push({
      label: "Кормлений записано",
      value: String(inPeriod.length),
    });
    const perDay = inPeriod.length / days;
    feeding.push({
      label: "В день",
      value: perDay.toLocaleString("ru-RU", { maximumFractionDigits: 1 }),
    });
  }
  if (nightFeedings > 0) {
    feeding.push({
      label: "Ночных отмечено",
      value: String(nightFeedings),
      hint: "в записях ночного сна, отдельно от списка выше",
    });
  }
  if (totalMl > 0) {
    feeding.push({ label: "Из бутылочки", value: `${totalMl} мл` });
  }

  const growth: SummaryLine[] = [];
  for (const key of ["weight", "height"] as const) {
    const info = METRICS[key];
    const points = seriesFor(key, child, measurements);
    if (points.length === 0) continue;

    const last = points[points.length - 1];
    const baseline =
      [...points].reverse().find((point) => point.at.getTime() <= from) ??
      points.find((point) => point.at.getTime() >= from);

    let hint: string | undefined;
    if (child.sex) {
      const z = zScoreFor(key, child.sex, last.ageDays, last.who);
      if (z !== null) {
        hint = `${formatPercentile(percentileFromZ(z))} перцентиль`;
      }
    }

    const delta =
      baseline && baseline !== last
        ? ` (${info.formatDelta(last.raw - baseline.raw)})`
        : "";

    growth.push({
      label: info.label,
      value: `${info.format(last.raw)}${delta}`,
      hint,
    });
  }

  const headline =
    stats.avgTotalMs !== null
      ? hoursAndMinutes(stats.avgTotalMs)
      : "нет данных";

  return {
    childName: child.name,
    age: formatAge(age),
    periodLabel: PERIOD_LABEL[period],
    headline,
    headlineHint: "сна в сутки",
    sleep,
    feeding,
    growth,
    madeOn: new Date(now).toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }),
  };
}

export function daysOfData(
  sessions: SleepSession[],
  period: Period,
  now: number,
): number {
  void differenceInCalendarDays;
  return computeSleepStats(sessions, period, now).days.filter(
    (day) => day.hasData,
  ).length;
}
