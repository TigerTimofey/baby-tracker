import { parseISO } from "date-fns";
import type {
  Feeding,
  NightFeedingKind,
  SleepSession,
} from "../../data/types";

export const HOUR_MS = 3_600_000;
export const DAY_MS = 24 * HOUR_MS;

export type Period = "7" | "14" | "30";

const MAX_WAKE_WINDOW_MS = 16 * HOUR_MS;

function overlap(fromA: number, toA: number, fromB: number, toB: number): number {
  return Math.max(0, Math.min(toA, toB) - Math.max(fromA, fromB));
}

export function startOfDay(value: Date): Date {
  const copy = new Date(value);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function addDays(value: Date, amount: number): Date {
  const copy = new Date(value);
  copy.setDate(copy.getDate() + amount);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function sessionStart(session: SleepSession): number {
  return parseISO(session.start_at).getTime();
}

function sessionEnd(session: SleepSession, now: number): number {
  return session.end_at ? parseISO(session.end_at).getTime() : now;
}

export interface DayBucket {
  key: string;
  date: Date;
  label: string;
  nightMs: number;
  napMs: number;
  totalMs: number;
  napCount: number;
  isToday: boolean;
  hasData: boolean;
}

export interface DaySpan {
  from: number;
  to: number;
  night: boolean;
}

export interface DayTimelineRow {
  day: DayBucket;
  sleep: DaySpan[];
  feedings: number[];
}

export interface WindowMetrics {
  daysCounted: number;
  avgTotalMs: number | null;
  avgNightMs: number | null;
  avgNapMs: number | null;
  avgNapCount: number | null;
  longestNightMs: number | null;

  bedtimeMinutes: number | null;
  wakeMinutes: number | null;
  nightCount: number;
  avgNapDurationMs: number | null;
  napSamples: number;
  avgWakeWindowMs: number | null;
  longestWakeWindowMs: number | null;
  wakeWindowSamples: number;

  avgNightFeedings: number | null;
  nightsWithFeedingNote: number;
  nightFeedingKind: NightFeedingKind | null;
}

export interface SleepStats extends WindowMetrics {
  days: DayBucket[];
  deltaMs: number | null;
  previous: WindowMetrics;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function medianClock(values: number[], pivot: number): number {
  const shifted = values.map((value) => (value < pivot ? value + 1440 : value));
  return Math.round(median(shifted)) % 1440;
}

export function formatClockMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = Math.round(minutes % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function buildDays(
  sessions: SleepSession[],
  count: number,
  now: number,
): DayBucket[] {
  const today = startOfDay(new Date(now));
  const buckets: DayBucket[] = [];

  for (let index = count - 1; index >= 0; index -= 1) {
    const date = addDays(today, -index);
    const from = date.getTime();
    const to = from + DAY_MS;

    let nightMs = 0;
    let napMs = 0;
    let napCount = 0;

    for (const session of sessions) {
      const start = sessionStart(session);
      const end = sessionEnd(session, now);
      const inside = overlap(start, end, from, to);
      if (inside > 0) {
        if (session.kind === "night") nightMs += inside;
        else napMs += inside;
      }
      if (session.kind === "nap" && start >= from && start < to) napCount += 1;
    }

    buckets.push({
      key: `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`,
      date,
      label: String(date.getDate()),
      nightMs,
      napMs,
      totalMs: nightMs + napMs,
      napCount,
      isToday: index === 0,
      hasData: nightMs + napMs > 0,
    });
  }

  return buckets;
}

function averageOfCompleteDays(days: DayBucket[]): {
  counted: number;
  total: number | null;
  night: number | null;
  nap: number | null;
  naps: number | null;
} {
  const usable = days.filter((day) => !day.isToday && day.hasData);
  if (usable.length === 0) {
    return { counted: 0, total: null, night: null, nap: null, naps: null };
  }

  const sum = (pick: (day: DayBucket) => number) =>
    usable.reduce((acc, day) => acc + pick(day), 0) / usable.length;

  return {
    counted: usable.length,
    total: sum((day) => day.totalMs),
    night: sum((day) => day.nightMs),
    nap: sum((day) => day.napMs),
    naps: sum((day) => day.napCount),
  };
}

const MIN_DAYS_FOR_COMPARISON = 3;
const MIN_NIGHTS = 3;

export function windowMetrics(
  sessions: SleepSession[],
  days: DayBucket[],
  from: number,
  to: number,
  now: number,
): WindowMetrics {
  const averages = averageOfCompleteDays(days);

  const inWindow = sessions.filter((session) => {
    const end = sessionEnd(session, now);
    return end > from && end <= to;
  });

  const nights = inWindow.filter(
    (session) => session.kind === "night" && session.end_at !== null,
  );

  const bedtimes = nights.map((session) => {
    const date = parseISO(session.start_at);
    return date.getHours() * 60 + date.getMinutes();
  });
  const wakes = nights.map((session) => {
    const date = parseISO(session.end_at as string);
    return date.getHours() * 60 + date.getMinutes();
  });

  const napDurations = inWindow
    .filter((session) => session.kind === "nap" && session.end_at !== null)
    .map((session) => sessionEnd(session, now) - sessionStart(session));

  const windows = wakeWindows(inWindow, now);

  const noted = nights.filter((session) => session.night_feedings != null);
  const kindTally = new Map<NightFeedingKind, number>();
  for (const session of noted) {
    if (!session.night_feeding_kind) continue;
    kindTally.set(
      session.night_feeding_kind,
      (kindTally.get(session.night_feeding_kind) ?? 0) + 1,
    );
  }
  const topKind =
    [...kindTally.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  return {
    daysCounted: averages.counted,
    avgTotalMs: averages.total,
    avgNightMs: averages.night,
    avgNapMs: averages.nap,
    avgNapCount: averages.naps,
    longestNightMs: nights.length
      ? Math.max(...nights.map((s) => sessionEnd(s, now) - sessionStart(s)))
      : null,
    bedtimeMinutes:
      nights.length >= MIN_NIGHTS ? medianClock(bedtimes, 12 * 60) : null,
    wakeMinutes: nights.length >= MIN_NIGHTS ? medianClock(wakes, 0) : null,
    nightCount: nights.length,
    avgNapDurationMs: napDurations.length
      ? napDurations.reduce((a, b) => a + b, 0) / napDurations.length
      : null,
    napSamples: napDurations.length,
    avgWakeWindowMs: windows.length
      ? windows.reduce((a, b) => a + b, 0) / windows.length
      : null,
    longestWakeWindowMs: windows.length ? Math.max(...windows) : null,
    wakeWindowSamples: windows.length,
    avgNightFeedings: noted.length
      ? noted.reduce((sum, item) => sum + (item.night_feedings ?? 0), 0) /
        noted.length
      : null,
    nightsWithFeedingNote: noted.length,
    nightFeedingKind: topKind,
  };
}

export function computeSleepStats(
  allSessions: SleepSession[],
  period: Period,
  now: number,
): SleepStats {
  const count = Number(period);
  const today = startOfDay(new Date(now));
  const windowStart = addDays(today, -(count - 1)).getTime();
  const previousStart = addDays(today, -(count * 2 - 1)).getTime();

  const relevant = allSessions.filter(
    (session) => sessionEnd(session, now) > previousStart,
  );

  const days = buildDays(relevant, count, now);
  const current = windowMetrics(relevant, days, windowStart, Infinity, now);

  const previousDays = buildDays(relevant, count * 2, now).slice(0, count);
  const previous = windowMetrics(
    relevant,
    previousDays,
    previousStart,
    windowStart,
    now,
  );

  const deltaMs =
    current.avgTotalMs !== null &&
    previous.avgTotalMs !== null &&
    current.daysCounted >= MIN_DAYS_FOR_COMPARISON &&
    previous.daysCounted >= MIN_DAYS_FOR_COMPARISON
      ? current.avgTotalMs - previous.avgTotalMs
      : null;

  return { days, deltaMs, previous, ...current };
}

export function buildTimelines(
  sessions: SleepSession[],
  feedings: Feeding[],
  days: DayBucket[],
  now: number,
): DayTimelineRow[] {
  return days.map((day) => {
    const from = startOfDay(day.date).getTime();
    const to = addDays(day.date, 1).getTime();
    const span = to - from;

    const sleep: DaySpan[] = [];
    for (const session of sessions) {
      const clipFrom = Math.max(sessionStart(session), from);
      const clipTo = Math.min(sessionEnd(session, now), to);
      if (clipTo <= clipFrom) continue;
      sleep.push({
        from: (clipFrom - from) / span,
        to: (clipTo - from) / span,
        night: session.kind === "night",
      });
    }

    const marks: number[] = [];
    for (const feeding of feedings) {
      const at = parseISO(feeding.start_at).getTime();
      if (at >= from && at < to) marks.push((at - from) / span);
    }

    return {
      day,
      sleep: sleep.sort((a, b) => a.from - b.from),
      feedings: marks.sort((a, b) => a - b),
    };
  });
}

export function wakeWindows(sessions: SleepSession[], now: number): number[] {
  const finished = sessions
    .filter((session) => session.end_at !== null)
    .sort((a, b) => sessionStart(a) - sessionStart(b));

  const result: number[] = [];

  for (let index = 1; index < finished.length; index += 1) {
    const gap =
      sessionStart(finished[index]) - sessionEnd(finished[index - 1], now);
    if (gap > 0 && gap <= MAX_WAKE_WINDOW_MS) result.push(gap);
  }

  return result;
}
