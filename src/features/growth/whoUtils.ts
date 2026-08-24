import type { Sex } from "../../data/types";
import {
  WHO_DAYS,
  WHO_LMS,
  WHO_MAX_AGE_DAYS,
  type WhoMetric,
} from "./whoData";

export interface Lms {
  l: number;
  m: number;
  s: number;
}

function interpolate(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function lmsAt(
  metric: WhoMetric,
  sex: Sex,
  ageDays: number,
): Lms | null {
  if (!Number.isFinite(ageDays) || ageDays < 0 || ageDays > WHO_MAX_AGE_DAYS) {
    return null;
  }

  const table = WHO_LMS[metric][sex];

  let low = 0;
  let high = WHO_DAYS.length - 1;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (WHO_DAYS[middle] <= ageDays) low = middle;
    else high = middle - 1;
  }

  const next = Math.min(low + 1, WHO_DAYS.length - 1);
  const span = WHO_DAYS[next] - WHO_DAYS[low];
  const t = span > 0 ? (ageDays - WHO_DAYS[low]) / span : 0;

  return {
    l: interpolate(table.l[low], table.l[next], t),
    m: interpolate(table.m[low], table.m[next], t),
    s: interpolate(table.s[low], table.s[next], t),
  };
}

function valueAtSd({ l, m, s }: Lms, sd: number): number {
  return l === 0 ? m * Math.exp(s * sd) : m * Math.pow(1 + l * s * sd, 1 / l);
}

function rawZ(value: number, { l, m, s }: Lms): number {
  return l === 0
    ? Math.log(value / m) / s
    : (Math.pow(value / m, l) - 1) / (l * s);
}

export function zScoreFor(
  metric: WhoMetric,
  sex: Sex,
  ageDays: number,
  value: number,
): number | null {
  const lms = lmsAt(metric, sex, ageDays);
  if (!lms || !(value > 0)) return null;

  const z = rawZ(value, lms);

  if (metric !== "weight" || Math.abs(z) <= 3) return z;

  if (z > 3) {
    const sd3 = valueAtSd(lms, 3);
    const sd2 = valueAtSd(lms, 2);
    return 3 + (value - sd3) / (sd3 - sd2);
  }

  const sd3 = valueAtSd(lms, -3);
  const sd2 = valueAtSd(lms, -2);
  return -3 + (value - sd3) / (sd2 - sd3);
}

export function valueAtZ(
  metric: WhoMetric,
  sex: Sex,
  ageDays: number,
  z: number,
): number | null {
  const lms = lmsAt(metric, sex, ageDays);
  return lms ? valueAtSd(lms, z) : null;
}

function erf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const abs = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * abs);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) *
      t +
      0.254829592) *
      t *
      Math.exp(-abs * abs);
  return sign * y;
}

export function percentileFromZ(z: number): number {
  return 0.5 * (1 + erf(z / Math.SQRT2)) * 100;
}

export function formatPercentile(percentile: number): string {
  if (percentile < 1) return "меньше 1-го";
  if (percentile > 99) return "больше 99-го";
  return `${Math.round(percentile)}-й`;
}
