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

export function plural(n: number, forms: [string, string, string]): string {
  const abs = Math.abs(n) % 100;
  const tail = abs % 10;
  if (abs > 10 && abs < 20) return forms[2];
  if (tail > 1 && tail < 5) return forms[1];
  if (tail === 1) return forms[0];
  return forms[2];
}

export function withPlural(n: number, forms: [string, string, string]): string {
  return `${n} ${plural(n, forms)}`;
}

const DAYS: [string, string, string] = ["день", "дня", "дней"];
const MONTHS: [string, string, string] = ["месяц", "месяца", "месяцев"];
const YEARS: [string, string, string] = ["год", "года", "лет"];

export function formatDuration(ms: number): string {
  if (ms < 0) ms = 0;
  const totalMinutes = Math.floor(ms / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (totalMinutes < 1) return `${Math.floor(ms / 1000)} сек`;
  if (hours === 0) return `${minutes} мин`;
  if (minutes === 0) return `${hours} ч`;
  return `${hours} ч ${minutes} мин`;
}

export function formatHoursMinutes(ms: number): string {
  if (ms < 0) ms = 0;
  const total = Math.round(ms / 60_000);
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return `${hours}:${String(minutes).padStart(2, "0")} ч`;
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
  return date.toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDate(value: Date | ISODateTime | ISODate): string {
  const date = typeof value === "string" ? parseISO(value) : value;
  return date.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function formatDayLabel(value: Date | ISODateTime): string {
  const date = typeof value === "string" ? parseISO(value) : value;
  if (isToday(date)) return "Сегодня";
  if (isYesterday(date)) return "Вчера";
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    ...(sameYear ? {} : { year: "numeric" }),
  });
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
  if (age.totalDays < 14) return withPlural(age.totalDays, DAYS);
  if (age.totalMonths < 2)
    return `${withPlural(age.totalWeeks, ["неделя", "недели", "недель"])}`;
  if (age.years === 0) {
    if (age.days === 0) return withPlural(age.months, MONTHS);
    return `${withPlural(age.months, MONTHS)} ${withPlural(age.days, DAYS)}`;
  }
  if (age.months === 0) return withPlural(age.years, YEARS);
  return `${withPlural(age.years, YEARS)} ${age.months} мес`;
}

export function formatWeight(grams: number | null): string {
  if (grams == null) return "—";
  return `${(grams / 1000).toLocaleString("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} кг`;
}

export function formatLength(mm: number | null): string {
  if (mm == null) return "—";
  return `${(mm / 10).toLocaleString("ru-RU", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })} см`;
}

export function parseTimeOfDay(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 23 || m > 59) return null;
  return h * 60 + m;
}
