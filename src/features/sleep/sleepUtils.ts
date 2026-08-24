/* ---------------------------------------------------------------
   Расчёты по сну.

   Главная тонкость: ночной сон пересекает полночь. Поэтому «сколько
   малыш спал сегодня» считается не по времени начала сна, а по тому,
   сколько минут сна попало внутрь суток.
   --------------------------------------------------------------- */

import { parseISO } from "date-fns";
import type { SleepKind, SleepSession } from "../../data/types";
import { dayKey } from "../../lib/time";

export const DAY_MS = 24 * 60 * 60 * 1000;

/** Ночной сон — тот, что начался вечером или ночью. Пользователь может поправить. */
export function guessKind(at: Date): SleepKind {
  const hour = at.getHours();
  return hour >= 19 || hour < 6 ? "night" : "nap";
}

export function kindLabel(kind: SleepKind): string {
  return kind === "night" ? "Ночной сон" : "Дневной сон";
}

export function startMs(session: SleepSession): number {
  return parseISO(session.start_at).getTime();
}

/** Для незавершённого сна концом считаем «сейчас». */
export function endMs(session: SleepSession, now: number): number {
  return session.end_at ? parseISO(session.end_at).getTime() : now;
}

export function durationMs(session: SleepSession, now: number): number {
  return Math.max(0, endMs(session, now) - startMs(session));
}

/** Сон, который идёт прямо сейчас (у него нет времени окончания). */
export function findActive(
  sessions: SleepSession[],
): SleepSession | undefined {
  return sessions.find((session) => session.end_at === null);
}

export function sortedByStartDesc(sessions: SleepSession[]): SleepSession[] {
  return [...sessions].sort((a, b) => startMs(b) - startMs(a));
}

/** Пересечение отрезка сна с произвольным окном времени. */
function overlapMs(
  fromA: number,
  toA: number,
  fromB: number,
  toB: number,
): number {
  return Math.max(0, Math.min(toA, toB) - Math.max(fromA, fromB));
}

/**
 * Сколько минут сна попало в сутки, начинающиеся в `dayStart`.
 * Ночной сон с 21:00 до 07:00 честно делится между двумя днями.
 */
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

/** Момент последнего пробуждения — от него считается время бодрствования. */
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
  /** Сумма снов, начавшихся в этот день, — ровно то, что видно в строках. */
  totalMs: number;
}

/**
 * История по дням, свежие сверху.
 *
 * Сон относится к тому дню, в который он начался. Ночной сон с 21:00 до
 * 07:00 целиком попадает во «вчера» — иначе итог дня не сходился бы с
 * суммой видимых строк, и это сбивало бы с толку. Вопрос «сколько всего
 * спал» закрывает карточка итогов за 24 часа.
 */
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
  /** Сколько раз укладывались. */
  count: number;
}

/**
 * Итоги за последние 24 часа.
 *
 * Именно окно, а не календарные сутки: в 9 утра родителю нужно знать,
 * сколько малыш спал вместе с прошедшей ночью, а не «ноль с полуночи».
 * И цифра не прыгает при переходе через полночь.
 */
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

/* ------------------------- возрастные ориентиры -------------------------
   Это средние значения из общедоступных рекомендаций по детскому сну.
   Они нужны только как подсказка «примерно пора» и не заменяют педиатра:
   разброс между здоровыми детьми огромный.
   ------------------------------------------------------------------- */

interface Band {
  /** Верхняя граница возраста в месяцах (включительно). */
  upToMonths: number;
  /** Комфортное бодрствование, минуты. */
  wakeMin: number;
  wakeMax: number;
  /** Сна за сутки, часы. */
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
