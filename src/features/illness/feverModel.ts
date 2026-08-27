import { addDays, startOfDay } from "date-fns";
import type { Medicine, Temperature, TempMethod } from "../../data/types";
import { givenMs } from "./medUtils";
import { feverThreshold, highThreshold, measuredMs } from "./tempUtils";

const HOUR = 3600_000;
const MIN_SPAN = 12 * HOUR;
/** Разрыв, после которого линию не тянем: что было ночью, мы не знаем. */
const BREAK_MS = 8 * HOUR;

export interface FeverModel {
  from: number;
  span: number;
  method: TempMethod;
  fever: number;
  high: number;
  low: number;
  top: number;
  degrees: number[];
  timeTicks: { at: number; midnight: boolean }[];
  segments: Temperature[][];
  points: Temperature[];
  marks: number[];
}

function dominantMethod(readings: Temperature[]): TempMethod {
  const tally = new Map<TempMethod, number>();
  for (const item of readings) {
    tally.set(item.method, (tally.get(item.method) ?? 0) + 1);
  }
  return [...tally.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

/**
 * Всё, что нужно нарисовать кривую, без привязки к размеру.
 *
 * Одна и та же математика питает график на экране и картинку для врача —
 * иначе они рано или поздно разошлись бы в мелочах.
 */
export function buildFeverModel(
  readings: Temperature[],
  doses: Medicine[],
  ageMonths: number,
  now: number,
): FeverModel | null {
  const points = [...readings].sort((a, b) => measuredMs(a) - measuredMs(b));
  if (points.length < 2) return null;

  const from = Math.min(measuredMs(points[0]), now - MIN_SPAN);
  const span = Math.max(MIN_SPAN, now - from);

  const method = dominantMethod(points);
  const fever = feverThreshold(method);
  const high = highThreshold(method, ageMonths);

  const values = points.map((item) => item.celsius);
  const low = Math.floor((Math.min(...values, fever) - 0.4) * 2) / 2;
  const top = Math.ceil((Math.max(...values, high) + 0.4) * 2) / 2;

  const degrees: number[] = [];
  for (let value = low; value <= top + 0.01; value += 0.5) {
    degrees.push(Math.round(value * 10) / 10);
  }

  const segments: Temperature[][] = [];
  for (const item of points) {
    const current = segments[segments.length - 1];
    if (
      current &&
      measuredMs(item) - measuredMs(current[current.length - 1]) <= BREAK_MS
    ) {
      current.push(item);
    } else {
      segments.push([item]);
    }
  }

  // Шаг подписей по времени подбираем под длину отрезка: на сутках уместны
  // трёхчасовые деления, на четырёх днях они слились бы в кашу.
  const spanHours = span / HOUR;
  const stepHours =
    spanHours <= 24 ? 3 : spanHours <= 48 ? 6 : spanHours <= 96 ? 12 : 24;

  const timeTicks: { at: number; midnight: boolean }[] = [];
  for (
    let day = startOfDay(new Date(from));
    day.getTime() <= now;
    day = addDays(day, 1)
  ) {
    for (let hour = 0; hour < 24; hour += stepHours) {
      const at = new Date(day);
      at.setHours(hour, 0, 0, 0);
      const ms = at.getTime();
      if (ms >= from && ms <= now) {
        timeTicks.push({ at: ms, midnight: hour === 0 });
      }
    }
  }

  const marks = doses
    .map(givenMs)
    .filter((at) => at >= from && at <= now)
    .sort((a, b) => a - b);

  return {
    from,
    span,
    method,
    fever,
    high,
    low,
    top,
    degrees,
    timeTicks,
    segments,
    points,
    marks,
  };
}
