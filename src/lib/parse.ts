export function parseDecimal(value: string): number | null {
  const normalized = value.trim().replace(",", ".").replace(/\s/g, "");
  if (normalized === "") return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function kgToGrams(value: string): number | null {
  const kg = parseDecimal(value);
  return kg == null ? null : Math.round(kg * 1000);
}

export function cmToMm(value: string): number | null {
  const cm = parseDecimal(value);
  return cm == null ? null : Math.round(cm * 10);
}

export function gramsToKgInput(grams: number | null): string {
  return grams == null ? "" : String(grams / 1000).replace(".", ",");
}

export function mmToCmInput(mm: number | null): string {
  return mm == null ? "" : String(mm / 10).replace(".", ",");
}

export function trimOrNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}
