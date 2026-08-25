import { parseISO } from "date-fns";
import type { NightFeedingKind, SleepKind, SleepSession } from "../../data/types";
import { plural } from "../../lib/time";
import { dayKey } from "../../lib/time";

export const DAY_MS = 24 * 60 * 60 * 1000;

export function guessKind(at: Date): SleepKind {
  const hour = at.getHours();
  return hour >= 19 || hour < 6 ? "night" : "nap";
}

export function kindLabel(kind: SleepKind): string {
  return kind === "night" ? "Ночной сон" : "Дневной сон";
}

export function nightFeedingWord(kind: NightFeedingKind): string {
  switch (kind) {
    case "breast":
      return "грудь";
    case "bottle":
      return "бутылочка";
    case "solid":
      return "прикорм";
  }
}

export function nightFeedingsLabel(session: SleepSession): string | null {
  const count = session.night_feedings;
  if (count == null || count === 0) return null;

  const parts = [
    `${count} ${plural(count, ["кормление", "кормления", "кормлений"])}`,
  ];
  if (session.night_feeding_kind) {
    parts.push(nightFeedingWord(session.night_feeding_kind));
  }
  if (session.night_feeding_ml) {
    parts.push(`по ${session.night_feeding_ml} мл`);
  }
  return parts.join(" · ");
}

export function startMs(session: SleepSession): number {
  return parseISO(session.start_at).getTime();
}

export function endMs(session: SleepSession, now: number): number {
  return session.end_at ? parseISO(session.end_at).getTime() : now;
}

export function durationMs(session: SleepSession, now: number): number {
  return Math.max(0, endMs(session, now) - startMs(session));
}

export function findActive(
  sessions: SleepSession[],
): SleepSession | undefined {
  return sessions.find((session) => session.end_at === null);
}

export function sortedByStartDesc(sessions: SleepSession[]): SleepSession[] {
  return [...sessions].sort((a, b) => startMs(b) - startMs(a));
}

function overlapMs(
  fromA: number,
  toA: number,
  fromB: number,
  toB: number,
): number {
  return Math.max(0, Math.min(toA, toB) - Math.max(fromA, fromB));
}

export function sleepMsInWindow(
  sessions: SleepSession[],
  windowStart: number,
  windowEnd: number,
  now: number,
): number {
  return sessions.reduce(
    (total, session) =>
      total +
      overlapMs(startMs(session), endMs(session, now), windowStart, windowEnd),
    0,
  );
}

export function lastWakeMs(sessions: SleepSession[]): number | null {
  let latest: number | null = null;
  for (const session of sessions) {
    if (!session.end_at) continue;
    const value = parseISO(session.end_at).getTime();
    if (latest === null || value > latest) latest = value;
  }
  return latest;
}

export interface DayGroup {
  key: string;
  date: Date;
  sessions: SleepSession[];
  totalMs: number;
}

export function groupByDay(sessions: SleepSession[], now: number): DayGroup[] {
  const buckets = new Map<string, SleepSession[]>();

  for (const session of sessions) {
    const key = dayKey(session.start_at);
    const bucket = buckets.get(key);
    if (bucket) bucket.push(session);
    else buckets.set(key, [session]);
  }

  return [...buckets.entries()]
    .map(([key, list]) => ({
      key,
      date: parseISO(list[0].start_at),
      sessions: sortedByStartDesc(list),
      totalMs: list.reduce(
        (total, session) => total + durationMs(session, now),
        0,
      ),
    }))
    .sort((a, b) => b.key.localeCompare(a.key));
}

export interface DayStats {
  totalMs: number;
  nightMs: number;
  napMs: number;
  count: number;
}

export function statsForLast24h(
  sessions: SleepSession[],
  now: number,
): DayStats {
  const from = now - DAY_MS;

  let nightMs = 0;
  let napMs = 0;
  let count = 0;

  for (const session of sessions) {
    const overlap = overlapMs(
      startMs(session),
      endMs(session, now),
      from,
      now,
    );
    if (overlap <= 0) continue;

    if (session.kind === "night") nightMs += overlap;
    else napMs += overlap;
    count += 1;
  }

  return { totalMs: nightMs + napMs, nightMs, napMs, count };
}

interface Band {
  upToMonths: number;
  wakeMin: number;
  wakeMax: number;
  sleepMinH: number;
  sleepMaxH: number;
}

const BANDS: Band[] = [
  { upToMonths: 1, wakeMin: 45, wakeMax: 60, sleepMinH: 14, sleepMaxH: 17 },
  { upToMonths: 2, wakeMin: 60, wakeMax: 90, sleepMinH: 14, sleepMaxH: 17 },
  { upToMonths: 3, wakeMin: 75, wakeMax: 105, sleepMinH: 14, sleepMaxH: 17 },
  { upToMonths: 4, wakeMin: 90, wakeMax: 120, sleepMinH: 12, sleepMaxH: 16 },
  { upToMonths: 6, wakeMin: 120, wakeMax: 150, sleepMinH: 12, sleepMaxH: 16 },
  { upToMonths: 9, wakeMin: 150, wakeMax: 210, sleepMinH: 12, sleepMaxH: 16 },
  { upToMonths: 12, wakeMin: 180, wakeMax: 240, sleepMinH: 12, sleepMaxH: 15 },
  { upToMonths: 18, wakeMin: 240, wakeMax: 330, sleepMinH: 11, sleepMaxH: 14 },
  { upToMonths: 24, wakeMin: 300, wakeMax: 360, sleepMinH: 11, sleepMaxH: 14 },
  { upToMonths: 36, wakeMin: 300, wakeMax: 420, sleepMinH: 10, sleepMaxH: 13 },
  { upToMonths: 60, wakeMin: 360, wakeMax: 720, sleepMinH: 10, sleepMaxH: 13 },
  { upToMonths: 9999, wakeMin: 420, wakeMax: 840, sleepMinH: 9, sleepMaxH: 12 },
];

export function bandFor(ageMonths: number): Band {
  return BANDS.find((band) => ageMonths <= band.upToMonths) ?? BANDS[BANDS.length - 1];
}
