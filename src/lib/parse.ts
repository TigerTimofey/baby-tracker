/* ---------------------------------------------------------------
   Разбор чисел, введённых человеком.

   В русской раскладке на цифровой клавиатуре запятая — привычный
   десятичный разделитель, поэтому «3,45» и «3.45» должны работать
   одинаково.
   --------------------------------------------------------------- */

export function parseDecimal(value: string): number | null {
  const normalized = value.trim().replace(",", ".").replace(/\s/g, "");
  if (normalized === "") return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

/** «3,45» → 3450 г. Внутри приложения вес всегда в целых граммах. */
export function kgToGrams(value: string): number | null {
  const kg = parseDecimal(value);
  return kg == null ? null : Math.round(kg * 1000);
}

/** «52,5» → 525 мм. */
export function cmToMm(value: string): number | null {
  const cm = parseDecimal(value);
  return cm == null ? null : Math.round(cm * 10);
}

/** Обратно — для подстановки в поле ввода. */
export function gramsToKgInput(grams: number | null): string {
  return grams == null ? "" : String(grams / 1000).replace(".", ",");
}

export function mmToCmInput(mm: number | null): string {
  return mm == null ? "" : String(mm / 10).replace(".", ",");
}

/** Пустая строка → null: в базе не должно быть пустых строк вместо «нет данных». */
export function trimOrNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}
