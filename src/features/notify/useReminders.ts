import { useEffect } from "react";
import { useLive, useSettings } from "../../data/hooks";
import { listByChild } from "../../data/repo";
import type { Child, SleepSession } from "../../data/types";
import {
  alreadyNotified,
  markNotified,
  notificationPermission,
  showNotification,
} from "../../lib/notifications";
import {
  ageOf,
  birthMoment,
  formatDuration,
  parseTimeOfDay,
} from "../../lib/time";
import { bandFor, bedtimeOf, findActive, lastWakeMs } from "../sleep/sleepUtils";

const CHECK_MS = 30_000;
const BEDTIME_WINDOW_MS = 60 * 60_000;
const NO_SESSIONS: SleepSession[] = [];

function dayKey(now: Date): string {
  return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
}

export function useReminders(child: Child | null): void {
  const settings = useSettings();
  const childId = child?.id;

  const { data } = useLive(
    async () =>
      childId ? await listByChild("sleep_sessions", childId) : NO_SESSIONS,
    [childId],
  );
  const sessions = data ?? NO_SESSIONS;

  const enabled = settings.notifications && Boolean(child);

  useEffect(() => {
    if (!enabled || !child) return;
    if (notificationPermission() !== "granted") return;

    const check = () => {
      const now = new Date();

      if (findActive(sessions)) return;

      const schedule = bedtimeOf(child, settings);
      const bedtimeMinutes = schedule.time
        ? parseTimeOfDay(schedule.time)
        : null;

      if (bedtimeMinutes !== null) {
        const bedtime = new Date(now);
        bedtime.setHours(
          Math.floor(bedtimeMinutes / 60),
          bedtimeMinutes % 60,
          0,
          0,
        );
        const untilBed = bedtime.getTime() - now.getTime();
        const warnMs = schedule.warnMinutes * 60_000;

        if (untilBed > 0 && untilBed <= warnMs) {
          const key = `bedtime-warn:${dayKey(now)}`;
          if (!alreadyNotified(key)) {
            markNotified(key);
            void showNotification(
              "bedtime-warn",
              "Скоро сон",
              `${child.name}: до отхода ко сну ${formatDuration(untilBed)}`,
            );
          }
        }

        if (untilBed <= 0 && untilBed > -BEDTIME_WINDOW_MS) {
          const key = `bedtime:${dayKey(now)}`;
          if (!alreadyNotified(key)) {
            markNotified(key);
            void showNotification(
              "bedtime",
              "Пора укладываться",
              `${child.name}: время сна — ${schedule.time}`,
            );
          }
        }
      }

      const wakeAt = lastWakeMs(sessions);
      if (wakeAt === null) return;

      const awake = now.getTime() - wakeAt;
      const age = ageOf(
        birthMoment(child.birth_date, child.birth_time),
        now,
      );
      const band = bandFor(age.totalMonths);

      if (awake > band.wakeMax * 60_000) {
        const key = `wake:${wakeAt}`;
        if (!alreadyNotified(key)) {
          markNotified(key);
          void showNotification(
            "wake-window",
            "Пора укладывать",
            `${child.name} бодрствует ${formatDuration(awake)} — обычно в ${age.totalMonths} мес до ${formatDuration(band.wakeMax * 60_000)}`,
          );
        }
      }
    };

    check();
    const timer = setInterval(check, CHECK_MS);
    return () => clearInterval(timer);
  }, [enabled, child, sessions, settings]);
}
