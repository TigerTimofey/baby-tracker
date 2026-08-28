import { parseISO } from "date-fns";
import type { DoseUnit, Medicine } from "../../data/types";

export const UNITS: DoseUnit[] = ["ml", "mg"];

export type Preset = "nurofen" | "suppository" | "other";

interface PresetInfo {
  id: Preset;
  label: string;
  name: string;
  unit: DoseUnit;
  /** Ходовые дозировки: их выбирают кнопкой, всё прочее — вручную. */
  doses: number[];
  /**
   * Через сколько часов можно давать снова.
   *
   * Для своего лекарства интервал неизвестен, поэтому там null — выдумывать
   * его приложение не должно.
   */
  gapHours: number | null;
}

/** Два лекарства покрывают почти все случаи, поэтому они вынесены в кнопки. */
export const PRESETS: PresetInfo[] = [
  {
    id: "nurofen",
    label: "Нурофен",
    name: "Нурофен",
    unit: "ml",
    doses: [1.25, 2, 2.5],
    gapHours: 6,
  },
  {
    id: "suppository",
    label: "Свечи",
    name: "Свечи (парацетамол)",
    unit: "mg",
    doses: [80, 125],
    gapHours: 6,
  },
  {
    id: "other",
    label: "Другое",
    name: "",
    unit: "ml",
    doses: [],
    gapHours: null,
  },
];

export const DEFAULT_PRESET: Preset = "suppository";

export function presetInfo(id: Preset): PresetInfo {
  return PRESETS.find((item) => item.id === id) ?? PRESETS[PRESETS.length - 1];
}

export function formatDose(value: number): string {
  return value.toLocaleString("ru-RU", { maximumFractionDigits: 2 });
}

export function presetForName(name: string): Preset {
  const known = PRESETS.find(
    (item) => item.id !== "other" && item.name === name,
  );
  return known?.id ?? "other";
}

export function unitLabel(unit: DoseUnit): string {
  return unit === "ml" ? "мл" : "мг";
}

export function givenMs(dose: Medicine): number {
  return parseISO(dose.given_at).getTime();
}

/** Короткое имя для строки журнала: полное остаётся в выгрузке для врача. */
export function shortName(name: string): string {
  return PRESETS.find((item) => item.name === name)?.label ?? name;
}

export function doseLine(dose: Medicine, short = false): string {
  const title = short ? shortName(dose.name) : dose.name;
  if (dose.amount === null) return title;
  const amount = dose.amount.toLocaleString("ru-RU", {
    maximumFractionDigits: 2,
  });
  return `${title} · ${amount} ${unitLabel(dose.unit)}`;
}

export interface NextDose {
  doseId: string;
  name: string;
  gapHours: number;
  readyAt: number;
  ready: boolean;
}

const SHOW_WITHIN_MS = 14 * 3600_000;

/**
 * Когда каждое из знакомых лекарств можно дать снова.
 *
 * Считаем от последней выдачи именно этого препарата: нурофен и парацетамол
 * не мешают друг другу, у каждого свой отсчёт. Давние выдачи не показываем —
 * «можно давать» про позавчерашний нурофен ничего не значит.
 */
export function nextDoses(doses: Medicine[], now: number): NextDose[] {
  const result: NextDose[] = [];

  for (const preset of PRESETS) {
    if (preset.gapHours === null) continue;

    const last = doses
      .filter((dose) => dose.name === preset.name)
      .sort((a, b) => givenMs(b) - givenMs(a))[0];
    if (!last) continue;

    const readyAt = givenMs(last) + preset.gapHours * 3600_000;
    if (now - givenMs(last) > SHOW_WITHIN_MS) continue;

    result.push({
      doseId: last.id,
      name: preset.name,
      gapHours: preset.gapHours,
      readyAt,
      ready: now >= readyAt,
    });
  }

  return result.sort((a, b) => a.readyAt - b.readyAt);
}

/**
 * Отсчёт привязан к самой свежей выдаче каждого лекарства.
 *
 * Дали то же самое ещё раз — таймер сам оказывается на новой записи, потому
 * что ключ здесь идентификатор последней дозы, а не место в списке.
 */
export function doseTimers(
  doses: Medicine[],
  now: number,
): Map<string, NextDose> {
  return new Map(nextDoses(doses, now).map((item) => [item.doseId, item]));
}
