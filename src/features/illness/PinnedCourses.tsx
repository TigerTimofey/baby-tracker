import { t } from "../../lib/i18n";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Icon } from "../../components/ui/Icon";
import { useLive, useNow } from "../../data/hooks";
import { listByChild } from "../../data/repo";
import type { Medicine, MedicineCourse } from "../../data/types";
import { toggleCourseSlot } from "./courseActions";
import {
  canToggleSlot,
  courseStatuses,
  dayStartBack,
  daysBackAvailable,
  slotsForDay,
  startedMs,
  startOfDay,
} from "./courseUtils";
import { DayNav } from "./DayNav";
import { courseTitle } from "./medUtils";
import pills from "./MedicineCourses.module.css";
import styles from "./PinnedCourses.module.css";

const NO_DOSES: Medicine[] = [];
const NO_COURSES: MedicineCourse[] = [];

/**
 * Закреплённые курсы на главном экране. Витамин D каждое утро — то, ради чего
 * открывают приложение чаще, чем ради вкладки «Аптечка»; тумблер там ставит
 * курс сюда. Пилюли те же и переключаются так же; название ведёт на вкладку.
 * Нет закреплённых — нет карточки.
 */
export function PinnedCourses({ childId }: { childId: string }) {
  const now = useNow(60_000);
  const navigate = useNavigate();
  // Один день на всю карточку: она компактная, по стрелкам на каждый курс
  // здесь не место. Назад — до самого раннего из закреплённых курсов.
  const [back, setBack] = useState(0);

  const { data: courseData } = useLive(
    async () => await listByChild("medicine_courses", childId),
    [childId],
  );
  const { data: doseData } = useLive(
    async () => await listByChild("medicines", childId),
    [childId],
  );

  const pinned = (courseData ?? NO_COURSES).filter((course) => course.pinned);
  const doses = doseData ?? NO_DOSES;
  const statuses = courseStatuses(pinned, doses, now);

  if (statuses.length === 0) return null;

  const maxBack = Math.max(
    ...statuses.map((status) => daysBackAvailable(status.course, now)),
  );
  const viewStart = dayStartBack(now, back);
  const today = viewStart === startOfDay(now);

  const open = () => navigate("/meds");

  return (
    <Card
      title={t("Аптечка")}
      className={styles.card}
      action={
        <Button size="sm" variant="ghost" onClick={open}>
          {t("Открыть")}
          <Icon name="chevron-right" size={16} />
        </Button>
      }
    >
      {maxBack > 0 && (
        <DayNav
          back={back}
          maxBack={maxBack}
          dayStart={viewStart}
          onChange={setBack}
          className={styles.nav}
        />
      )}

      {statuses.map((status) => {
        // Курс, которого в тот день ещё не было, пилюль не показывает.
        const notYet = startOfDay(startedMs(status.course)) > viewStart;
        const slots = today
          ? status.slots
          : slotsForDay(status.course, doses, viewStart, now);

        return (
        <div key={status.course.id} className={styles.row}>
          <button
            type="button"
            className={[
              styles.name,
              today && status.due ? styles.nameDue : "",
              today && status.expired ? styles.nameExpired : "",
            ]
              .filter(Boolean)
              .join(" ")}
            onClick={open}
          >
            {courseTitle(status.course)}
          </button>

          {notYet ? (
            <span className={styles.expired}>{t("ещё не начат")}</span>
          ) : today && status.expired ? (
            <span className={styles.expired}>{t("срок вышел")}</span>
          ) : (
            <div className={styles.slots}>
              {slots.map((slot) => (
                <button
                  key={slot.time}
                  type="button"
                  aria-pressed={slot.given}
                  disabled={!canToggleSlot(slot, now)}
                  className={[
                    pills.slot,
                    styles.small,
                    slot.given ? pills.slotGiven : "",
                    slot.next ? pills.slotNext : "",
                    slot.next && status.due ? pills.slotDue : "",
                    slot.past ? pills.slotPast : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => void toggleCourseSlot(childId, status, slot)}
                >
                  {slot.given && <Icon name="check" size={14} />}
                  {slot.time}
                </button>
              ))}
            </div>
          )}
        </div>
        );
      })}
    </Card>
  );
}
