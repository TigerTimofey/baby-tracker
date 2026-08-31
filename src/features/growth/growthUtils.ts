import { decimalInput, locale, t } from "../../lib/i18n";
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
  return value.toLocaleString(locale(), {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export const METRICS: Record<WhoMetric, MetricInfo> = {
  weight: {
    key: "weight",
    get label() {

      return t("Вес");

    },
    get short() {

      return t("вес");

    },
    get unit() {

      return t("кг");

    },
    field: "weight_g",
    toWho: (grams) => grams / 1000,
    fromInput: (text) => {
      const kg = decimal(text);
      return kg === null ? null : Math.round(kg * 1000);
    },
    toInput: (grams) => (grams == null ? "" : decimalInput(grams / 1000)),
    format: (grams) => t("{0} кг", [ru(grams / 1000, 2)]),
    formatDelta: (grams) => {
      const sign = grams >= 0 ? "+" : "−";
      const abs = Math.abs(grams);
      return abs >= 1000 ? t("{0}{1} кг", [sign, ru(abs / 1000, 2)]) : t("{0}{1} г", [sign, abs]);
    },
    get placeholder() {
      return t("7,25");
    },
  },
  height: {
    key: "height",
    get label() {

      return t("Рост");

    },
    get short() {

      return t("рост");

    },
    get unit() {

      return t("см");

    },
    field: "height_mm",
    toWho: (mm) => mm / 10,
    fromInput: (text) => {
      const cm = decimal(text);
      return cm === null ? null : Math.round(cm * 10);
    },
    toInput: (mm) => (mm == null ? "" : decimalInput(mm / 10)),
    format: (mm) => t("{0} см", [ru(mm / 10, 1)]),
    formatDelta: (mm) => t("{0}{1} см", [mm >= 0 ? "+" : "−", ru(Math.abs(mm) / 10, 1)]),
    get placeholder() {
      return t("68,5");
    },
  },
  head: {
    key: "head",
    get label() {

      return t("Голова");

    },
    get short() {

      return t("окружность головы");

    },
    get unit() {

      return t("см");

    },
    field: "head_mm",
    toWho: (mm) => mm / 10,
    fromInput: (text) => {
      const cm = decimal(text);
      return cm === null ? null : Math.round(cm * 10);
    },
    toInput: (mm) => (mm == null ? "" : decimalInput(mm / 10)),
    format: (mm) => t("{0} см", [ru(mm / 10, 1)]),
    formatDelta: (mm) => t("{0}{1} см", [mm >= 0 ? "+" : "−", ru(Math.abs(mm) / 10, 1)]),
    get placeholder() {
      return t("43,2");
    },
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
