import { parseISO } from "date-fns";
import type { SleepSession } from "../../data/types";
import { wakeWindows } from "../stats/statsUtils";
import { bandFor, lastWakeMs } from "./sleepUtils";

const HISTORY_DAYS = 14;
const MAX_SAMPLES = 10;
const MIN_SAMPLES = 3;

export interface SleepForecast {
  at: number;
  basedOn: "history" | "age";
  samples: number;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function forecastNextSleep(
  sessions: SleepSession[],
  ageMonths: number,
  now: number,
): SleepForecast | null {
  const wakeAt = lastWakeMs(sessions);
  if (wakeAt === null) return null;

  const since = now - HISTORY_DAYS * 24 * 3600_000;
  const recent = sessions.filter(
    (session) => parseISO(session.start_at).getTime() >= since,
  );

  const windows = wakeWindows(recent, now).slice(-MAX_SAMPLES);

  if (windows.length >= MIN_SAMPLES) {
    return {
      at: wakeAt + median(windows),
      basedOn: "history",
      samples: windows.length,
    };
  }

  const band = bandFor(ageMonths);
  const middle = ((band.wakeMin + band.wakeMax) / 2) * 60_000;
  return { at: wakeAt + middle, basedOn: "age", samples: 0 };
}
