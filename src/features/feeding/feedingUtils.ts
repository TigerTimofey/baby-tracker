import { parseISO } from "date-fns";
import type { Feeding, FeedingKind } from "../../data/types";

export const FEEDING_KINDS: FeedingKind[] = [
  "breast_left",
  "breast_right",
  "bottle",
  "solid",
];

export function kindLabel(kind: FeedingKind): string {
  switch (kind) {
    case "breast_left":
      return "Грудь, левая";
    case "breast_right":
      return "Грудь, правая";
    case "bottle":
      return "Бутылочка";
    case "solid":
      return "Прикорм";
  }
}

export function kindShort(kind: FeedingKind): string {
  switch (kind) {
    case "breast_left":
      return "левая";
    case "breast_right":
      return "правая";
    case "bottle":
      return "бутылочка";
    case "solid":
      return "прикорм";
  }
}

export function isBreast(kind: FeedingKind): boolean {
  return kind === "breast_left" || kind === "breast_right";
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
 * Повторяем то, чем кормили в прошлый раз, а грудь чередуем — так и делают.
 */
export function suggestKind(feedings: Feeding[]): FeedingKind {
  const previous = lastFinished(feedings) ?? sortedByStartDesc(feedings)[0];
  if (!previous) return "breast_left";
  if (previous.kind === "breast_left") return "breast_right";
  if (previous.kind === "breast_right") return "breast_left";
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
