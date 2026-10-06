import { t } from "../../lib/i18n";
import { useState } from "react";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Icon } from "../../components/ui/Icon";
import type { MedicineCourse } from "../../data/types";
import { formatDate } from "../../lib/time";
import { removeCourse, resumeCourse } from "./courseActions";
import { finishedCourses } from "./courseUtils";
import { MedicineCourseEditor } from "./MedicineCourseEditor";
import { courseTitle } from "./medUtils";
import styles from "./MedicineCourses.module.css";

interface FinishedCoursesProps {
  childId: string;
  courses: MedicineCourse[];
}

/**
 * «История лекарств» — законченные курсы своей сворачиваемой карточкой над
 * «Историей болезней», свёрнутой по умолчанию: это прошлое, и листать его
 * каждый день незачем. Строка на курс, раскрывается на месте: «Повторить
 * курс», «Вернуть курс», «Изменить», «Удалить». Нет законченных — нет
 * карточки.
 */
export function FinishedCourses({ childId, courses }: FinishedCoursesProps) {
  const [open, setOpen] = useState<string | null>(null);
  const [editing, setEditing] = useState<MedicineCourse | null>(null);
  /** Образец для повтора: шторка открывается заполненной, сохранится новый. */
  const [copyOf, setCopyOf] = useState<MedicineCourse | null>(null);

  const finished = finishedCourses(courses);
  if (finished.length === 0) return null;

  /**
   * Повторить — не вернуть: тот курс остаётся законченным в истории, а новый
   * начинается сегодня с теми же лекарством, дозой и расписанием. Шторка
   * открывается заполненной, чтобы поправить, если что-то поменялось.
   */
  function openCopy(course: MedicineCourse) {
    setOpen(null);
    setEditing(null);
    setCopyOf(course);
  }

  function resume(course: MedicineCourse) {
    setOpen(null);
    void resumeCourse(course);
  }

  return (
    <>
      <Card title={t("История лекарств")} collapsible>
        {finished.map((course) => {
          const isOpen = open === course.id;
          return (
            <div key={course.id} className={styles.finishedItem}>
              <button
                type="button"
                className={styles.finishedRow}
                aria-expanded={isOpen}
                onClick={() => setOpen(isOpen ? null : course.id)}
              >
                <span className={styles.finishedName}>{courseTitle(course)}</span>
                <span className={styles.finishedWhen}>
                  {t("до {0}", [formatDate(course.ended_at as string)])}
                </span>
                <span
                  className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ""}`}
                  aria-hidden="true"
                >
                  <Icon name="chevron-down" size={16} />
                </span>
              </button>

              {isOpen && (
                <div className={styles.details}>
                  <Button variant="primary" block onClick={() => openCopy(course)}>
                    {t("Повторить курс")}
                  </Button>
                  <Button variant="secondary" block onClick={() => resume(course)}>
                    {t("Вернуть курс")}
                  </Button>
                  <div className={styles.detailsRow}>
                    <Button variant="secondary" onClick={() => setEditing(course)}>
                      <Icon name="pencil" size={16} />
                      {t("Изменить")}
                    </Button>
                    <Button
                      variant="danger"
                      onClick={() => void removeCourse(course)}
                    >
                      <Icon name="trash" size={16} />
                      {t("Удалить")}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </Card>

      {editing && (
        <MedicineCourseEditor
          key={editing.id}
          open
          onClose={() => setEditing(null)}
          childId={childId}
          course={editing}
        />
      )}
      {copyOf && (
        <MedicineCourseEditor
          key={`copy-${copyOf.id}`}
          open
          onClose={() => setCopyOf(null)}
          childId={childId}
          copyOf={copyOf}
        />
      )}
    </>
  );
}
