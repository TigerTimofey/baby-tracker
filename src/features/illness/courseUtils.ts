import { differenceInCalendarDays, parseISO } from "date-fns";
import type { Medicine, MedicineCourse } from "../../data/types";
import { parseTimeOfDay } from "../../lib/time";
import { givenMs } from "./medUtils";

export const MAX_TIMES = 6;

const DAY_MS = 24 * 3600_000;

/**
 * Сколько приём остаётся «пора дать» после своего времени. Дальше он считается
 * пропущенным, плашка переходит к следующему, а напоминание больше не шлётся:
 * родитель либо дал и не записал, либо решил пропустить, и догонять его
 * вечером утренним приёмом незачем.
 */
export const LATE_WINDOW_MS = 2 * 3600_000;

/**
 * За сколько до срока следующий приём уже можно отметить: дали в 19:40
 * вместо 20:00 — нормально. Полтора часа меньше половины любого ходового
 * расписания, так что нажатие ляжет на свой приём, а не на соседний.
 */
export const EARLY_WINDOW_MS = 90 * 60_000;

/**
 * Ходовые расписания по числу приёмов: с чего начать, пока родитель не
 * поправил время под себя. Все в часы бодрствования, кроме шести раз в день —
 * это «каждые четыре часа», и ночной приём там неизбежен.
 */
const DEFAULT_TIMES: string[][] = [
  [],
  ["09:00"],
  ["09:00", "21:00"],
  ["08:00", "14:00", "20:00"],
  ["08:00", "12:00", "16:00", "20:00"],
  ["07:00", "11:00", "15:00", "19:00", "23:00"],
  ["02:00", "06:00", "10:00", "14:00", "18:00", "22:00"],
];

export function defaultTimes(count: number): string[] {
  const clamped = Math.min(Math.max(count, 1), MAX_TIMES);
  return [...DEFAULT_TIMES[clamped]];
}

/** Запасные времена, когда ходовое расписание исчерпано: каждый час суток. */
const HOURLY = Array.from(
  { length: 24 },
  (_, hour) => `${String(hour).padStart(2, "0")}:00`,
);

const MIN_FILL_GAP_MINUTES = 120;

/** Расстояние между двумя временами суток по кругу: 23:00 и 01:00 — два часа. */
function clockGap(a: string, b: string): number {
  const x = parseTimeOfDay(a);
  const y = parseTimeOfDay(b);
  if (x === null || y === null) return Number.POSITIVE_INFINITY;
  const direct = Math.abs(x - y);
  return Math.min(direct, 24 * 60 - direct);
}

/**
 * Поменяли число приёмов.
 *
 * Если времена ещё не трогали — стоит ходовое расписание на прежнее число, —
 * ставим ходовое на новое: с трёх на четыре это 08:00, 12:00, 16:00, 20:00,
 * а не три старых плюс одно новое. Иначе четвёртым временем становилось
 * 20:00 из расписания «на четыре», которое уже стояло третьим.
 *
 * Если времена правили, они остаются: убираем лишние с конца, недостающие
 * добираем из ходового расписания, минуя занятые и те, что ближе двух часов
 * к уже стоящим — к 07:30 и 13:00 третьим добавится 20:00, а не 08:00.
 * Иначе каждое нажатие на «3» или «4» стирало бы то, что родитель только
 * что набрал.
 */
export function resizeTimes(current: string[], count: number): string[] {
  const defaults = defaultTimes(count);
  const untouched =
    current.join() === defaultTimes(current.length).join();
  if (untouched) return defaults;

  const kept = current.slice(0, defaults.length);
  const candidates = [...defaults, ...HOURLY];
  // Сначала с запасом в два часа от соседей, потом — лишь бы не совпадало.
  for (const minGap of [MIN_FILL_GAP_MINUTES, 1]) {
    for (const candidate of candidates) {
      if (kept.length >= defaults.length) break;
      if (kept.includes(candidate)) continue;
      if (kept.some((time) => clockGap(time, candidate) < minGap)) continue;
      kept.push(candidate);
    }
  }
  return sortTimes(kept);
}

export function sortTimes(times: string[]): string[] {
  return [...times].sort(
    (a, b) => (parseTimeOfDay(a) ?? 0) - (parseTimeOfDay(b) ?? 0),
  );
}

/** «Амоксициллин» и «амоксициллин » — одно лекарство. */
export function sameMedicine(a: string, b: string): boolean {
  return a.trim().toLocaleLowerCase() === b.trim().toLocaleLowerCase();
}

export function startedMs(course: MedicineCourse): number {
  return parseISO(course.started_at).getTime();
}

export function activeCourses(courses: MedicineCourse[]): MedicineCourse[] {
  return courses
    .filter((course) => course.ended_at === null)
    .sort((a, b) => startedMs(a) - startedMs(b));
}

export function finishedCourses(courses: MedicineCourse[]): MedicineCourse[] {
  return courses
    .filter((course) => course.ended_at !== null)
    .sort(
      (a, b) =>
        parseISO(b.ended_at as string).getTime() -
        parseISO(a.ended_at as string).getTime(),
    );
}

function slotMs(dayStart: number, time: string): number | null {
  const minutes = parseTimeOfDay(time);
  if (minutes === null) return null;
  const at = new Date(dayStart);
  at.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return at.getTime();
}

/** Один приём из расписания на сегодня — для пилюль под плашкой. */
export interface CourseSlot {
  time: string;
  at: number;
  /** На этот приём есть выдача: ближайшая к нему по времени за сегодня. */
  given: boolean;
  /** Те самые выдачи — чтобы снять отметку, удалив именно их. */
  doseIds: string[];
  /** Следующий приём — ждём его или уже пора. */
  next: boolean;
  /** Время прошло, выдачи нет и это уже не следующий: пропущен или был до начала курса. */
  past: boolean;
}

export interface CourseStatus {
  course: MedicineCourse;
  /** Сколько раз это лекарство уже дали сегодня — любым способом. */
  givenToday: number;
  /** Сколько приёмов в расписании на день. */
  planned: number;
  /** Последняя сегодняшняя выдача. */
  lastGivenAt: number | null;
  /** Ближайший незакрытый приём, сегодня или завтра утром. */
  nextAt: number;
  /** Время приёма наступило, а дозы ещё нет. */
  due: boolean;
  /** На сегодня приёмов не осталось. */
  doneToday: boolean;
  slots: CourseSlot[];
  /** Какой сегодня день курса, с первого; null у курса без срока. */
  dayIndex: number | null;
  /** Срок вышел: приёмов и напоминаний больше нет, курс ждёт «Завершить». */
  expired: boolean;
}

/**
 * Срок курса. У курсов, заведённых до появления срока, поля нет вовсе —
 * в локальной базе оно undefined, а не null; читаем как «без срока».
 */
export function courseDays(course: MedicineCourse): number | null {
  return course.days ?? null;
}

/** Какой сегодня день курса, считая день начала первым. */
export function courseDay(course: MedicineCourse, now: number): number {
  return differenceInCalendarDays(now, startedMs(course)) + 1;
}

export function isExpired(course: MedicineCourse, now: number): boolean {
  const days = courseDays(course);
  return days !== null && courseDay(course, now) > days;
}

/**
 * Где курс находится прямо сейчас.
 *
 * Каждая сегодняшняя выдача закрывает ближайший к ней по времени приём: дали
 * в 13:30 вместо 14:00 — приём в 14:00 закрыт. Следующий — первый незакрытый
 * приём, не раньше начала курса (курс, заведённый вечером, не требует
 * утренних приёмов) и не старше двух часов (дальше приём считается
 * пропущенным, а не ждёт весь день). Выдачи считаются по названию, поэтому
 * доза, записанная через обычное «Лекарство», закрывает приём так же, как
 * нажатие на пилюлю.
 */
/** Сколько дней назад можно листать у курса: до дня его начала. */
export function daysBackAvailable(course: MedicineCourse, now: number): number {
  return Math.max(0, differenceInCalendarDays(now, startedMs(course)));
}

/** Начало суток, отлистанных на back дней назад от сегодняшних. */
export function dayStartBack(now: number, back: number): number {
  const day = new Date(startOfDay(now));
  day.setDate(day.getDate() - back);
  return day.getTime();
}

export function startOfDay(at: number): number {
  const day = new Date(at);
  day.setHours(0, 0, 0, 0);
  return day.getTime();
}

/** Выдачи этого лекарства за календарный день, начинающийся в dayStart. */
export function dosesOfDay(
  course: MedicineCourse,
  doses: Medicine[],
  dayStart: number,
): { id: string; at: number }[] {
  return doses
    .filter((dose) => sameMedicine(dose.name, course.name))
    .map((dose) => ({ id: dose.id, at: givenMs(dose) }))
    .filter(({ at }) => at >= dayStart && at < dayStart + DAY_MS);
}

/**
 * Приёмы одного дня с выдачами этого дня — для пилюль, сегодняшних и
 * прошлых. Каждая выдача закрывает ближайший к ней по времени приём.
 * «Следующего» здесь нет: он есть только у сегодняшнего дня, его ставит
 * courseStatus.
 */
export function slotsForDay(
  course: MedicineCourse,
  doses: Medicine[],
  dayStart: number,
  now: number,
): CourseSlot[] {
  const schedule = sortTimes(course.times)
    .map((time) => ({ time, at: slotMs(dayStart, time) }))
    .filter((slot): slot is { time: string; at: number } => slot.at !== null);

  const covered = new Map<number, string[]>();
  for (const { id, at } of dosesOfDay(course, doses, dayStart)) {
    const nearest = nearestSlotAt(schedule, at);
    if (nearest !== null) covered.set(nearest, [...(covered.get(nearest) ?? []), id]);
  }

  return schedule.map((slot) => {
    const doseIds = covered.get(slot.at) ?? [];
    const given = doseIds.length > 0;
    return { ...slot, given, doseIds, next: false, past: slot.at < now && !given };
  });
}

export function courseStatus(
  course: MedicineCourse,
  doses: Medicine[],
  now: number,
): CourseStatus {
  const dayStart = startOfDay(now);

  const dayIndex = courseDays(course) === null ? null : courseDay(course, now);
  const expired = isExpired(course, now);

  const today = dosesOfDay(course, doses, dayStart);
  const lastGivenAt =
    today.length > 0 ? Math.max(...today.map(({ at }) => at)) : null;

  const base = slotsForDay(course, doses, dayStart, now);

  // Срок вышел — приёмов больше нет: ни «пора», ни напоминаний.
  const floor = Math.max(startedMs(course), now - LATE_WINDOW_MS);
  const pending = expired
    ? undefined
    : base.find((slot) => !slot.given && slot.at >= floor);

  // Сегодня приёмов не осталось — следующий первым по расписанию завтра.
  // Через setDate, а не +24 часа: в ночь перевода часов сутки не равны суткам.
  const tomorrow = new Date(dayStart);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const nextAt =
    pending?.at ??
    (base.length > 0
      ? (slotMs(tomorrow.getTime(), base[0].time) ?? tomorrow.getTime())
      : tomorrow.getTime());

  const slots: CourseSlot[] = base.map((slot) =>
    pending !== undefined && slot.at === pending.at
      ? { ...slot, next: true, past: false }
      : slot,
  );

  return {
    course,
    givenToday: today.length,
    planned: base.length,
    lastGivenAt,
    nextAt,
    due: pending !== undefined && now >= pending.at,
    doneToday: pending === undefined,
    slots: expired ? [] : slots,
    dayIndex,
    expired,
  };
}

/** Приём, к которому ближе всего данное время; null без расписания. */
export function nearestSlotAt(
  slots: { at: number }[],
  at: number,
): number | null {
  let nearest: number | null = null;
  for (const slot of slots) {
    if (nearest === null || Math.abs(slot.at - at) < Math.abs(nearest - at)) {
      nearest = slot.at;
    }
  }
  return nearest;
}

/**
 * Можно ли нажать пилюлю сейчас: отмеченную — всегда (снять), прошедшую —
 * всегда (задним числом), следующую — за полтора часа до срока, остальные
 * будущие — нет: выдача, которой ещё не было, в журнале была бы выдумкой.
 */
export function canToggleSlot(slot: CourseSlot, now: number): boolean {
  if (slot.given || slot.at <= now) return true;
  return slot.next && slot.at - now <= EARLY_WINDOW_MS;
}

/**
 * Каким временем записать выдачу по нажатию на пустую пилюлю.
 *
 * Следующий приём — тот, что происходит сейчас: пишем текущее время, оно
 * честнее. Но только если оно и само легло бы на эту пилюлю; при тесном
 * расписании вроде 08:00 и 09:00 нажатие в 08:50 иначе зажгло бы соседнюю.
 * Пропущенный приём отмечают задним числом — временем самого приёма: родитель
 * говорит «утреннюю дал», а не «даю сейчас».
 */
export function doseTimeForSlot(
  status: CourseStatus,
  slot: CourseSlot,
  now: number,
): number | null {
  if (!canToggleSlot(slot, now) || slot.given) return null;
  if (slot.next) {
    return nearestSlotAt(status.slots, now) === slot.at ? now : slot.at;
  }
  return slot.at;
}

export function courseStatuses(
  courses: MedicineCourse[],
  doses: Medicine[],
  now: number,
): CourseStatus[] {
  return activeCourses(courses).map((course) =>
    courseStatus(course, doses, now),
  );
}
