import { parseISO } from "date-fns";
import type { Temperature, TempMethod } from "../../data/types";

export const METHODS: TempMethod[] = ["forehead", "armpit", "rectal"];

export const DEFAULT_METHOD: TempMethod = "forehead";

export function methodLabel(method: TempMethod): string {
  switch (method) {
    case "armpit":
      return "Подмышка";
    case "forehead":
      return "Лоб";
    case "rectal":
      return "Ректально";
  }
}

/**
 * Порог жара свой у каждого способа: одна и та же температура тела даёт
 * разные показания. Ректально мерят ближе всего к настоящей температуре,
 * подмышкой — заметно ниже.
 */
const FEVER: Record<TempMethod, number> = {
  armpit: 37.5,
  forehead: 37.8,
  rectal: 38,
};

/**
 * Насколько выше порога температура считается тревожной — зависит от возраста.
 *
 * У младенца до трёх месяцев тревожен любой жар, а двухлетний спокойно
 * переносит то, из-за чего к трёхмесячному вызывают врача. Поэтому запас
 * растёт с возрастом, а сам порог жара остаётся привязан к способу измерения.
 */
function highMargin(ageMonths: number): number {
  if (ageMonths < 3) return 0;
  if (ageMonths < 6) return 0.8;
  if (ageMonths < 24) return 1.2;
  return 1.6;
}

export function highThreshold(method: TempMethod, ageMonths: number): number {
  return Math.round((FEVER[method] + highMargin(ageMonths)) * 10) / 10;
}

export type TempLevel = "low" | "normal" | "raised" | "high";

export function levelOf(reading: Temperature, ageMonths: number): TempLevel {
  if (reading.celsius < 35.5) return "low";
  if (reading.celsius >= highThreshold(reading.method, ageMonths)) return "high";
  if (reading.celsius >= FEVER[reading.method]) return "raised";
  return "normal";
}

export function levelWord(level: TempLevel): string {
  switch (level) {
    case "low":
      return "пониженная";
    case "normal":
      return "в норме";
    case "raised":
      return "повышенная";
    case "high":
      return "высокая";
  }
}

export function feverThreshold(method: TempMethod): number {
  return FEVER[method];
}

export function formatCelsius(value: number): string {
  return `${value.toLocaleString("ru-RU", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })} °C`;
}

export function measuredMs(reading: Temperature): number {
  return parseISO(reading.measured_at).getTime();
}

export function sortedByTimeDesc(readings: Temperature[]): Temperature[] {
  return [...readings].sort((a, b) => measuredMs(b) - measuredMs(a));
}

export interface FeverSpell {
  readings: Temperature[];
  last: Temperature;
  peak: Temperature;
  since: number;
}

const SPELL_GAP_MS = 36 * 3600_000;

/**
 * Череда измерений, идущих подряд без большого перерыва, — одна болезнь.
 *
 * Перерыв больше полутора суток считаем концом: иначе давняя простуда
 * склеилась бы с новой и «болеет 40 дней» было бы враньём.
 */
export function currentSpell(
  readings: Temperature[],
  now: number,
): FeverSpell | null {
  const sorted = sortedByTimeDesc(readings);
  if (sorted.length === 0) return null;
  if (now - measuredMs(sorted[0]) > SPELL_GAP_MS) return null;

  const spell: Temperature[] = [sorted[0]];
  for (let index = 1; index < sorted.length; index += 1) {
    const gap = measuredMs(spell[spell.length - 1]) - measuredMs(sorted[index]);
    if (gap > SPELL_GAP_MS) break;
    spell.push(sorted[index]);
  }

  const peak = spell.reduce((top, item) =>
    item.celsius > top.celsius ? item : top,
  );

  return {
    readings: spell,
    last: spell[0],
    peak,
    since: measuredMs(spell[spell.length - 1]),
  };
}
