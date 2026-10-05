import { t } from "../../lib/i18n";
import { useEffect } from "react";
import { useLive, useSettings } from "../../data/hooks";
import { listByChild } from "../../data/repo";
import type {
  Child,
  Medicine,
  MedicineCourse,
  SleepSession,
} from "../../data/types";
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
  formatTime,
  parseTimeOfDay,
} from "../../lib/time";
import { courseStatuses } from "../illness/courseUtils";
import { formatDose, nextDoses, unitLabel } from "../illness/medUtils";
import { bandFor, bedtimeOf, findActive, lastWakeMs } from "../sleep/sleepUtils";

const CHECK_MS = 30_000;
const BEDTIME_WINDOW_MS = 60 * 60_000;
const NO_SESSIONS: SleepSession[] = [];
const NO_DOSES: Medicine[] = [];
const NO_COURSES: MedicineCourse[] = [];

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

  const { data: doseData } = useLive(
    async () => (childId ? await listByChild("medicines", childId) : NO_DOSES),
    [childId],
  );
  const doses = doseData ?? NO_DOSES;

  const { data: courseData } = useLive(
    async () =>
      childId ? await listByChild("medicine_courses", childId) : NO_COURSES,
    [childId],
  );
  const courses = courseData ?? NO_COURSES;

  const enabled = settings.notifications && Boolean(child);

  useEffect(() => {
    if (!enabled || !child) return;
    if (notificationPermission() !== "granted") return;

    const check = () => {
      const now = new Date();

      // Лекарство не зависит от того, спит ли ребёнок, поэтому проверяем
      // до раннего выхода по активному сну.
      for (const dose of nextDoses(doses, now.getTime())) {
        if (!dose.ready) continue;
        const key = `dose:${dose.name}:${dose.readyAt}`;
        if (alreadyNotified(key)) continue;
        markNotified(key);
        void showNotification(
          "medicine",
          t("Можно дать лекарство"),
          t("{0}: прошло {1} ч с прошлого раза", [dose.name, dose.gapHours]),
        );
      }

      // Приём по курсу: ключ — курс и время приёма, поэтому каждое напоминание
      // уходит один раз, а выдача, записанная любым способом, его снимает.
      // «Пора» живёт два часа после срока (LATE_WINDOW_MS в courseUtils),
      // дальше приём считается пропущенным и напоминание не шлётся.
      for (const status of courseStatuses(courses, doses, now.getTime())) {
        if (!status.due) continue;
        const key = `course:${status.course.id}:${status.nextAt}`;
        if (alreadyNotified(key)) continue;
        markNotified(key);
        const what =
          status.course.amount === null
            ? status.course.name
            : `${status.course.name} ${formatDose(status.course.amount)} ${unitLabel(status.course.unit)}`;
        void showNotification(
          "medicine",
          t("Пора дать лекарство"),
          t("{0} — приём в {1}", [what, formatTime(new Date(status.nextAt))]),
        );
      }

      if (findActive(sessions)) return;

      const schedule = bedtimeOf(child, settings);
      const bedtimeMinutes = schedule.time
        ? parseTimeOfDay(schedule.time)
        : null;

      if (bedtimeMinutes !== null && child.notify_bedtime) {
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
              t("Скоро сон"),
              t("{0}: до отхода ко сну {1}", [child.name, formatDuration(untilBed)]),
            );
          }
        }

        if (untilBed <= 0 && untilBed > -BEDTIME_WINDOW_MS) {
          const key = `bedtime:${dayKey(now)}`;
          if (!alreadyNotified(key)) {
            markNotified(key);
            void showNotification(
              "bedtime",
              t("Пора укладываться"),
              t("{0}: время сна — {1}", [child.name, schedule.time ?? ""]),
            );
          }
        }
      }

      if (!child.notify_wake_window) return;

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
            t("Пора укладывать"),
            t("{0} бодрствует {1} — обычно в {2} мес до {3}", [child.name, formatDuration(awake), age.totalMonths, formatDuration(band.wakeMax * 60_000)]),
          );
        }
      }
    };

    check();
    const timer = setInterval(check, CHECK_MS);
    return () => clearInterval(timer);
  }, [enabled, child, sessions, doses, courses, settings]);
}
