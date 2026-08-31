import { locale, t, withCount } from "./i18n";
import {
  addMonths,
  addYears,
  differenceInCalendarDays,
  differenceInMonths,
  differenceInYears,
  isToday,
  isYesterday,
  parseISO,
} from "date-fns";
import type { ISODate, ISODateTime } from "../data/types";

const DAYS = "день";
const MONTHS = "месяц";
const YEARS = "год";

export function formatDuration(ms: number): string {
  if (ms < 0) ms = 0;
  const totalMinutes = Math.floor(ms / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (totalMinutes < 1) return t("{0} сек", [Math.floor(ms / 1000)]);
  if (hours === 0) return t("{0} мин", [minutes]);
  if (minutes === 0) return t("{0} ч", [hours]);
  return t("{0} ч {1} мин", [hours, minutes]);
}

export function formatHoursMinutes(ms: number): string {
  if (ms < 0) ms = 0;
  const total = Math.round(ms / 60_000);
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return t("{0}:{1} ч", [hours, String(minutes).padStart(2, "0")]);
}

export function formatClock(ms: number): string {
  if (ms < 0) ms = 0;
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

export function formatTime(value: Date | ISODateTime): string {
  const date = typeof value === "string" ? parseISO(value) : value;
  return date.toLocaleTimeString(locale(), {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDate(value: Date | ISODateTime | ISODate): string {
  const date = typeof value === "string" ? parseISO(value) : value;
  return date.toLocaleDateString(locale(), {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function dayAndMonth(date: Date): string {
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString(locale(), {
    day: "numeric",
    month: "long",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

/**
 * Дата с годом: «1 сентября 2026». В истории болезней год нужен всегда —
 * записи живут годами, и «1 сентября» без года там ничего не значит.
 * Русская локаль дописывает «г.», для подписи это лишнее.
 */
export function formatFullDate(value: Date | ISODateTime): string {
  return formatDate(value).replace(/\s*г\.$/, "");
}

export function formatDayLabel(value: Date | ISODateTime): string {
  const date = typeof value === "string" ? parseISO(value) : value;
  if (isToday(date)) return t("Сегодня");
  if (isYesterday(date)) return t("Вчера");
  return dayAndMonth(date);
}

/**
 * Число и месяц без «Сегодня» и «Вчера».
 *
 * Нужно там, где относительной подписи мало: в журнале болезни дату потом
 * показывают врачу, и «Сегодня» ему ничего не скажет.
 */
export function formatDayDate(value: Date | ISODateTime): string {
  return dayAndMonth(typeof value === "string" ? parseISO(value) : value);
}

export function dayKey(value: Date | ISODateTime): string {
  const date = typeof value === "string" ? parseISO(value) : value;
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

export function resolveLocalInput(
  value: string,
  original: ISODateTime | null,
): Date | null {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  if (original && toLocalInputValue(original) === value) {
    return parseISO(original);
  }
  return parsed;
}

export function toLocalInputValue(value: Date | ISODateTime): string {
  const date = typeof value === "string" ? parseISO(value) : value;
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

export interface Age {
  years: number;
  months: number;
  days: number;
  totalMonths: number;
  totalDays: number;
  totalWeeks: number;
}

export function birthMoment(birthDate: ISODate, birthTime: string | null): Date {
  const date = parseISO(birthDate);
  if (birthTime) {
    const [h, m] = birthTime.split(":").map(Number);
    if (!Number.isNaN(h)) date.setHours(h, Number.isNaN(m) ? 0 : m, 0, 0);
  }
  return date;
}

export function ageOf(birth: Date, now: Date = new Date()): Age {
  const years = Math.max(0, differenceInYears(now, birth));
  const afterYears = addYears(birth, years);
  const months = Math.max(0, differenceInMonths(now, afterYears));
  const afterMonths = addMonths(afterYears, months);
  const days = Math.max(0, differenceInCalendarDays(now, afterMonths));
  const totalDays = Math.max(0, differenceInCalendarDays(now, birth));

  return {
    years,
    months,
    days,
    totalMonths: Math.max(0, differenceInMonths(now, birth)),
    totalDays,
    totalWeeks: Math.floor(totalDays / 7),
  };
}

export function formatAge(age: Age): string {
  if (age.totalDays < 14) return withCount(age.totalDays, DAYS);
  if (age.totalMonths < 2)
    return withCount(age.totalWeeks, "неделя");
  if (age.years === 0) {
    if (age.days === 0) return withCount(age.months, MONTHS);
    return `${withCount(age.months, MONTHS)} ${withCount(age.days, DAYS)}`;
  }
  if (age.months === 0) return withCount(age.years, YEARS);
  return `${withCount(age.years, YEARS)} ${t("{0} мес", [age.months])}`;
}

export function formatWeight(grams: number | null): string {
  if (grams == null) return "—";
  return t("{0} кг", [
    (grams / 1000).toLocaleString(locale(), {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }),
  ]);
}

export function formatLength(mm: number | null): string {
  if (mm == null) return "—";
  return t("{0} см", [
    (mm / 10).toLocaleString(locale(), {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }),
  ]);
}

export function parseTimeOfDay(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 23 || m > 59) return null;
  return h * 60 + m;
}
