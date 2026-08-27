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
}

/** Два лекарства покрывают почти все случаи, поэтому они вынесены в кнопки. */
export const PRESETS: PresetInfo[] = [
  {
    id: "nurofen",
    label: "Нурофен",
    name: "Нурофен",
    unit: "ml",
    doses: [1.25, 2, 2.5],
  },
  {
    id: "suppository",
    label: "Свечи",
    name: "Свечи (парацетамол)",
    unit: "mg",
    doses: [80, 125],
  },
  { id: "other", label: "Другое", name: "", unit: "ml", doses: [] },
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

export function doseLine(dose: Medicine): string {
  if (dose.amount === null) return dose.name;
  const amount = dose.amount.toLocaleString("ru-RU", {
    maximumFractionDigits: 2,
  });
  return `${dose.name} · ${amount} ${unitLabel(dose.unit)}`;
}
