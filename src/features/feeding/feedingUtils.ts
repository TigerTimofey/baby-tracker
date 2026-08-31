import { t } from "../../lib/i18n";
import { parseISO } from "date-fns";
import type { Feeding, FeedingKind } from "../../data/types";

export const FEEDING_KINDS: FeedingKind[] = [
  "breast",
  "breast_left",
  "breast_right",
  "bottle",
  "solid",
];

export function kindLabel(kind: FeedingKind): string {
  switch (kind) {
    case "breast":
      return t("Грудь");
    case "breast_left":
      return t("Грудь, левая");
    case "breast_right":
      return t("Грудь, правая");
    case "bottle":
      return t("Бутылочка");
    case "solid":
      return t("Прикорм");
  }
}

export function kindShort(kind: FeedingKind): string {
  switch (kind) {
    case "breast":
      return t("грудь");
    case "breast_left":
      return t("левая");
    case "breast_right":
      return t("правая");
    case "bottle":
      return t("бутылочка");
    case "solid":
      return t("прикорм");
  }
}

export function isBreast(kind: FeedingKind): boolean {
  return (
    kind === "breast" || kind === "breast_left" || kind === "breast_right"
  );
}

export function startMs(feeding: Feeding): number {
  return parseISO(feeding.start_at).getTime();
}

export function endMs(feeding: Feeding, now: number): number {
  return feeding.end_at ? parseISO(feeding.end_at).getTime() : now;
}

export function durationMs(feeding: Feeding, now: number): number {
  return Math.max(0, endMs(feeding, now) - startMs(feeding));
}

export function findActive(feedings: Feeding[]): Feeding | undefined {
  return feedings.find((feeding) => feeding.end_at === null);
}

export function sortedByStartDesc(feedings: Feeding[]): Feeding[] {
  return [...feedings].sort((a, b) => startMs(b) - startMs(a));
}

export function lastFinished(feedings: Feeding[]): Feeding | null {
  const finished = feedings.filter((feeding) => feeding.end_at !== null);
  if (finished.length === 0) return null;
  return sortedByStartDesc(finished)[0];
}

/**
 * Чем начать следующее кормление.
 *
 * Повторяем то, чем кормили в прошлый раз. Если стороны груди записываются,
 * ещё и чередуем их — так и делают.
 */
export function suggestKind(
  feedings: Feeding[],
  trackSide: boolean,
): FeedingKind {
  const previous = lastFinished(feedings) ?? sortedByStartDesc(feedings)[0];

  if (!trackSide) {
    if (!previous) return "breast";
    return isBreast(previous.kind) ? "breast" : previous.kind;
  }

  if (!previous) return "breast_left";
  if (previous.kind === "breast_left") return "breast_right";
  if (previous.kind === "breast_right") return "breast_left";
  if (previous.kind === "breast") return "breast_left";
  return previous.kind;
}

export function feedingsOnDay(
  feedings: Feeding[],
  dayStart: number,
  dayEnd: number,
): Feeding[] {
  return sortedByStartDesc(
    feedings.filter((feeding) => {
      const start = startMs(feeding);
      return start >= dayStart && start < dayEnd;
    }),
  );
}

export interface FeedingDay {
  key: string;
  date: Date;
  feedings: Feeding[];
  totalMl: number;
}

/** История по дням — как у сна, чтобы обе ленты читались одинаково. */
export function groupByDay(feedings: Feeding[]): FeedingDay[] {
  const days = new Map<string, FeedingDay>();

  for (const feeding of sortedByStartDesc(feedings)) {
    const at = new Date(startMs(feeding));
    at.setHours(0, 0, 0, 0);
    const key = at.toDateString();

    const day = days.get(key);
    if (day) {
      day.feedings.push(feeding);
      day.totalMl += feeding.amount_ml ?? 0;
    } else {
      days.set(key, {
        key,
        date: at,
        feedings: [feeding],
        totalMl: feeding.amount_ml ?? 0,
      });
    }
  }

  return [...days.values()].sort(
    (a, b) => b.date.getTime() - a.date.getTime(),
  );
}
