import { parseISO } from "date-fns";
import type { Feeding } from "../../data/types";
import { formatDuration, plural } from "../../lib/time";
import {
  addDays,
  formatClockMinutes,
  startOfDay,
  type Period,
  type SleepStats,
  type WindowMetrics,
} from "./statsUtils";

const MIN_SAMPLES = 3;

type ChangeKind = "duration" | "count" | "clock" | "ml";

export interface ChangeRow {
  label: string;
  before: string;
  after: string;
  change: string;
  direction: "up" | "down" | "flat";
  basis: string;
}

export interface Changes {
  rows: ChangeRow[];
  periodLabel: string;
  shortfall: string | null;
}

/**
 * Округляем до той же точности, с какой значение показано на экране.
 *
 * Иначе получается ложь на границе округления: «12 ч 30 мин» против
 * «12 ч 31 мин» при разнице в две секунды дало бы «+0 мин». Сначала
 * округляем оба значения, потом вычитаем — тогда показанное изменение
 * всегда равно разности показанных чисел.
 */
function quantize(value: number, kind: ChangeKind): number {
  if (kind === "duration") return Math.round(value / 60_000) * 60_000;
  if (kind === "count") return Math.round(value * 10) / 10;
  return Math.round(value);
}

function formatValue(value: number, kind: ChangeKind): string {
  if (kind === "duration") return formatDuration(value);
  if (kind === "count")
    return value.toLocaleString("ru-RU", { maximumFractionDigits: 1 });
  if (kind === "ml") return `${value} мл`;
  return formatClockMinutes(value);
}

function clockDelta(before: number, after: number): number {
  let delta = after - before;
  if (delta > 720) delta -= 1440;
  if (delta < -720) delta += 1440;
  return delta;
}

function formatChange(delta: number, kind: ChangeKind): string {
  const size = Math.abs(delta);
  const sign = delta > 0 ? "+" : "−";

  if (kind === "clock") {
    return `на ${formatDuration(size * 60_000)} ${delta > 0 ? "позже" : "раньше"}`;
  }
  if (kind === "duration") return `${sign}${formatDuration(size)}`;
  if (kind === "ml") return `${sign}${size} мл`;
  return `${sign}${size.toLocaleString("ru-RU", { maximumFractionDigits: 1 })}`;
}

interface RowInput {
  label: string;
  kind: ChangeKind;
  before: number | null;
  after: number | null;
  samplesBefore: number;
  samplesAfter: number;
  unit: [string, string, string];
}

function buildRow(input: RowInput): ChangeRow | null {
  const { before, after, samplesBefore, samplesAfter } = input;
  if (before === null || after === null) return null;
  if (samplesBefore < MIN_SAMPLES || samplesAfter < MIN_SAMPLES) return null;

  const from = quantize(before, input.kind);
  const to = quantize(after, input.kind);
  const delta =
    input.kind === "clock" ? clockDelta(from, to) : to - from;

  return {
    label: input.label,
    before: formatValue(from, input.kind),
    after: formatValue(to, input.kind),
    change: delta === 0 ? "без изменений" : formatChange(delta, input.kind),
    direction: delta === 0 ? "flat" : delta > 0 ? "up" : "down",
    basis: `по ${samplesAfter} ${plural(samplesAfter, input.unit)} против ${samplesBefore}`,
  };
}

interface FeedingWindow {
  perDay: number | null;
  days: number;
  mlPerDay: number | null;
  mlDays: number;
}

function feedingWindow(
  feedings: Feeding[],
  from: number,
  to: number,
  todayStart: number,
): FeedingWindow {
  const byDay = new Map<number, { count: number; ml: number; hasMl: boolean }>();

  for (const feeding of feedings) {
    const at = parseISO(feeding.start_at).getTime();
    if (at < from || at >= to) continue;

    const day = startOfDay(new Date(at)).getTime();
    if (day >= todayStart) continue;

    const bucket = byDay.get(day) ?? { count: 0, ml: 0, hasMl: false };
    bucket.count += 1;
    if (feeding.amount_ml != null) {
      bucket.ml += feeding.amount_ml;
      bucket.hasMl = true;
    }
    byDay.set(day, bucket);
  }

  const buckets = [...byDay.values()];
  const withMl = buckets.filter((bucket) => bucket.hasMl);
  const average = (list: number[]) =>
    list.length ? list.reduce((a, b) => a + b, 0) / list.length : null;

  return {
    perDay: average(buckets.map((bucket) => bucket.count)),
    days: buckets.length,
    mlPerDay: average(withMl.map((bucket) => bucket.ml)),
    mlDays: withMl.length,
  };
}

const DAYS: [string, string, string] = ["дню", "дням", "дням"];
const NIGHTS: [string, string, string] = ["ночи", "ночам", "ночам"];
const NAPS: [string, string, string] = ["сну", "снам", "снам"];
const GAPS: [string, string, string] = [
  "промежутку",
  "промежуткам",
  "промежуткам",
];

export function buildChanges(
  stats: SleepStats,
  feedings: Feeding[],
  period: Period,
  now: number,
): Changes {
  const count = Number(period);
  const today = startOfDay(new Date(now));
  const todayStart = today.getTime();
  const windowStart = addDays(today, -(count - 1)).getTime();
  const previousStart = addDays(today, -(count * 2 - 1)).getTime();

  const after: WindowMetrics = stats;
  const before = stats.previous;

  const feedAfter = feedingWindow(feedings, windowStart, Infinity, todayStart);
  const feedBefore = feedingWindow(
    feedings,
    previousStart,
    windowStart,
    todayStart,
  );

  const candidates: RowInput[] = [
    {
      label: "Сон за сутки",
      kind: "duration",
      before: before.avgTotalMs,
      after: after.avgTotalMs,
      samplesBefore: before.daysCounted,
      samplesAfter: after.daysCounted,
      unit: DAYS,
    },
    {
      label: "Ночной сон",
      kind: "duration",
      before: before.avgNightMs,
      after: after.avgNightMs,
      samplesBefore: before.daysCounted,
      samplesAfter: after.daysCounted,
      unit: DAYS,
    },
    {
      label: "Дневной сон за день",
      kind: "duration",
      before: before.avgNapMs,
      after: after.avgNapMs,
      samplesBefore: before.daysCounted,
      samplesAfter: after.daysCounted,
      unit: DAYS,
    },
    {
      label: "Снов за день",
      kind: "count",
      before: before.avgNapCount,
      after: after.avgNapCount,
      samplesBefore: before.daysCounted,
      samplesAfter: after.daysCounted,
      unit: DAYS,
    },
    {
      label: "Длительность дневного сна",
      kind: "duration",
      before: before.avgNapDurationMs,
      after: after.avgNapDurationMs,
      samplesBefore: before.napSamples,
      samplesAfter: after.napSamples,
      unit: NAPS,
    },
    {
      label: "Окно бодрствования",
      kind: "duration",
      before: before.avgWakeWindowMs,
      after: after.avgWakeWindowMs,
      samplesBefore: before.wakeWindowSamples,
      samplesAfter: after.wakeWindowSamples,
      unit: GAPS,
    },
    {
      label: "Засыпает вечером",
      kind: "clock",
      before: before.bedtimeMinutes,
      after: after.bedtimeMinutes,
      samplesBefore: before.nightCount,
      samplesAfter: after.nightCount,
      unit: NIGHTS,
    },
    {
      label: "Просыпается утром",
      kind: "clock",
      before: before.wakeMinutes,
      after: after.wakeMinutes,
      samplesBefore: before.nightCount,
      samplesAfter: after.nightCount,
      unit: NIGHTS,
    },
    {
      label: "Кормлений за ночь",
      kind: "count",
      before: before.avgNightFeedings,
      after: after.avgNightFeedings,
      samplesBefore: before.nightsWithFeedingNote,
      samplesAfter: after.nightsWithFeedingNote,
      unit: NIGHTS,
    },
    {
      label: "Кормлений за день",
      kind: "count",
      before: feedBefore.perDay,
      after: feedAfter.perDay,
      samplesBefore: feedBefore.days,
      samplesAfter: feedAfter.days,
      unit: DAYS,
    },
    {
      label: "Из бутылочки за день",
      kind: "ml",
      before: feedBefore.mlPerDay,
      after: feedAfter.mlPerDay,
      samplesBefore: feedBefore.mlDays,
      samplesAfter: feedAfter.mlDays,
      unit: DAYS,
    },
  ];

  const rows = candidates
    .map(buildRow)
    .filter((row): row is ChangeRow => row !== null);

  const skipped = candidates.length - rows.length;

  let shortfall: string | null = null;
  if (rows.length === 0) {
    shortfall = `Сравнивать пока нечего: нужно хотя бы по ${MIN_SAMPLES} записи в каждом из двух соседних отрезков.`;
  } else if (skipped > 0) {
    shortfall = `Ещё ${skipped} ${plural(skipped, ["показатель", "показателя", "показателей"])} не показаны: в одном из отрезков меньше ${MIN_SAMPLES} записей.`;
  }

  return {
    rows,
    periodLabel: `${count} ${plural(count, ["день", "дня", "дней"])} против предыдущих ${count}`,
    shortfall,
  };
}
