import { differenceInCalendarDays, parseISO } from "date-fns";
import type { Child, Measurement } from "../../data/types";
import { birthMoment } from "../../lib/time";
import type { WhoMetric } from "./whoData";

export interface MetricInfo {
  key: WhoMetric;
  label: string;
  short: string;
  unit: string;
  field: "weight_g" | "height_mm" | "head_mm";
  toWho: (raw: number) => number;
  fromInput: (text: string) => number | null;
  toInput: (raw: number | null) => string;
  format: (raw: number) => string;
  formatDelta: (raw: number) => string;
  placeholder: string;
}

function decimal(text: string): number | null {
  const normalized = text.trim().replace(",", ".").replace(/\s/g, "");
  if (normalized === "") return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function ru(value: number, digits: number): string {
  return value.toLocaleString("ru-RU", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export const METRICS: Record<WhoMetric, MetricInfo> = {
  weight: {
    key: "weight",
    label: "Вес",
    short: "вес",
    unit: "кг",
    field: "weight_g",
    toWho: (grams) => grams / 1000,
    fromInput: (text) => {
      const kg = decimal(text);
      return kg === null ? null : Math.round(kg * 1000);
    },
    toInput: (grams) => (grams == null ? "" : String(grams / 1000).replace(".", ",")),
    format: (grams) => `${ru(grams / 1000, 2)} кг`,
    formatDelta: (grams) => {
      const sign = grams >= 0 ? "+" : "−";
      const abs = Math.abs(grams);
      return abs >= 1000 ? `${sign}${ru(abs / 1000, 2)} кг` : `${sign}${abs} г`;
    },
    placeholder: "7,25",
  },
  height: {
    key: "height",
    label: "Рост",
    short: "рост",
    unit: "см",
    field: "height_mm",
    toWho: (mm) => mm / 10,
    fromInput: (text) => {
      const cm = decimal(text);
      return cm === null ? null : Math.round(cm * 10);
    },
    toInput: (mm) => (mm == null ? "" : String(mm / 10).replace(".", ",")),
    format: (mm) => `${ru(mm / 10, 1)} см`,
    formatDelta: (mm) => `${mm >= 0 ? "+" : "−"}${ru(Math.abs(mm) / 10, 1)} см`,
    placeholder: "68,5",
  },
  head: {
    key: "head",
    label: "Голова",
    short: "окружность головы",
    unit: "см",
    field: "head_mm",
    toWho: (mm) => mm / 10,
    fromInput: (text) => {
      const cm = decimal(text);
      return cm === null ? null : Math.round(cm * 10);
    },
    toInput: (mm) => (mm == null ? "" : String(mm / 10).replace(".", ",")),
    format: (mm) => `${ru(mm / 10, 1)} см`,
    formatDelta: (mm) => `${mm >= 0 ? "+" : "−"}${ru(Math.abs(mm) / 10, 1)} см`,
    placeholder: "43,2",
  },
};

export const METRIC_ORDER: WhoMetric[] = ["weight", "height", "head"];

export interface Point {
  id: string;
  at: Date;
  ageDays: number;
  raw: number;
  who: number;
}

export function ageDaysAt(child: Child, at: Date): number {
  return Math.max(
    0,
    differenceInCalendarDays(at, birthMoment(child.birth_date, child.birth_time)),
  );
}

export function seriesFor(
  metric: WhoMetric,
  child: Child,
  measurements: Measurement[],
): Point[] {
  const info = METRICS[metric];

  return measurements
    .map((measurement) => {
      const raw = measurement[info.field];
      if (raw == null) return null;
      const at = parseISO(measurement.measured_at);
      return {
        id: measurement.id,
        at,
        ageDays: ageDaysAt(child, at),
        raw,
        who: info.toWho(raw),
      };
    })
    .filter((point): point is Point => point !== null)
    .sort((a, b) => a.at.getTime() - b.at.getTime());
}

export function sortedMeasurements(items: Measurement[]): Measurement[] {
  return [...items].sort(
    (a, b) => parseISO(b.measured_at).getTime() - parseISO(a.measured_at).getTime(),
  );
}

export interface Gain {
  deltaRaw: number;
  days: number;
}

export function gainSincePrevious(points: Point[]): Gain | null {
  if (points.length < 2) return null;
  const last = points[points.length - 1];
  const previous = points[points.length - 2];
  const days = differenceInCalendarDays(last.at, previous.at);
  if (days <= 0) return null;
  return { deltaRaw: last.raw - previous.raw, days };
}

const RATE_WINDOW_DAYS = 56;
const RATE_MIN_DAYS = 7;

/** Средняя прибавка в неделю за последние восемь недель. */
export function weeklyRate(points: Point[]): number | null {
  if (points.length < 2) return null;

  const last = points[points.length - 1];
  const earliest = points.find(
    (point) =>
      differenceInCalendarDays(last.at, point.at) <= RATE_WINDOW_DAYS &&
      point !== last,
  );
  if (!earliest) return null;

  const days = differenceInCalendarDays(last.at, earliest.at);
  if (days < RATE_MIN_DAYS) return null;

  return ((last.raw - earliest.raw) / days) * 7;
}
