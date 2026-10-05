import { t } from "../../lib/i18n";
import { useState } from "react";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Icon } from "../../components/ui/Icon";
import { Switch } from "../../components/ui/Switch";
import { showToast } from "../../components/ui/toast";
import { nowISO, restore, save, softDelete } from "../../data/repo";
import type { Medicine, MedicineCourse } from "../../data/types";
import {
  dayKey,
  formatDate,
  formatDayDate,
  formatDuration,
  formatTime,
} from "../../lib/time";
import {
  canToggleSlot,
  courseDays,
  courseStatuses,
  dayStartBack,
  daysBackAvailable,
  dosesOfDay,
  finishedCourses,
  slotsForDay,
  startOfDay,
  type CourseSlot,
  type CourseStatus,
} from "./courseUtils";
import { setCoursePinned, toggleCourseSlot } from "./courseActions";
import { DayNav } from "./DayNav";
import { MedicineCourseEditor } from "./MedicineCourseEditor";
import { courseTitle } from "./medUtils";
import styles from "./MedicineCourses.module.css";

/** Законченных курсов копится много, а нужны последние: вернуть или удалить. */
const SHOW_FINISHED = 5;

interface MedicineCoursesProps {
  childId: string;
  courses: MedicineCourse[];
  doses: Medicine[];
  now: number;
}

/**
 * Карточка «Лекарства». На каждый идущий курс — плашка: что это, когда дали
 * в последний раз и крупно — во сколько следующий приём. Под ней приёмы дня
 * пилюлями: нажатие отмечает выдачу — название, доза и единицы берутся из
 * курса, — ещё одно снимает. Плашка раскрывается, как заголовок
 * сворачиваемой карточки: под ней «Завершить курс», «Изменить» и «Удалить».
 * Сами выдачи ложатся в тот же журнал, что и обычное «Лекарство», поэтому
 * врач видит одну ленту.
 */
export function MedicineCourses({
  childId,
  courses,
  doses,
  now,
}: MedicineCoursesProps) {
  const [editorOpen, setEditorOpen] = useState(false);
  const [picked, setPicked] = useState<MedicineCourse | null>(null);
  /** Раскрытый курс — один за раз, как болезни в истории. */
  const [open, setOpen] = useState<string | null>(null);
  /**
   * На сколько дней назад отлистаны пилюли у каждого курса: 0 — сегодня.
   * Как в «Ленте дня»: стрелки влево-вправо, в будущее нельзя, раньше
   * начала курса — тоже, там приёмов не было.
   */
  const [shift, setShift] = useState<Record<string, number>>({});

  function shiftOf(id: string): number {
    return shift[id] ?? 0;
  }

  function setShiftOf(id: string, value: number) {
    setShift({ ...shift, [id]: value });
  }

  const statuses = courseStatuses(courses, doses, now);
  const finished = finishedCourses(courses).slice(0, SHOW_FINISHED);
  const empty = statuses.length === 0 && finished.length === 0;

  function openNew() {
    setPicked(null);
    setEditorOpen(true);
  }

  function openEdit(course: MedicineCourse) {
    setPicked(course);
    setEditorOpen(true);
  }

  function toggleOpen(id: string) {
    setOpen(open === id ? null : id);
  }

  function toggleSlot(status: CourseStatus, slot: CourseSlot) {
    void toggleCourseSlot(childId, status, slot);
  }

  /**
   * Удаление сразу, без вопроса, с «Вернуть» в тосте — как у всех записей
   * здесь. Выдачи в журнале остаются: курс лишь подсказывал, записи — свои.
   */
  async function remove(course: MedicineCourse) {
    await softDelete("medicine_courses", course.id);
    showToast(t("Курс удалён"), {
      label: t("Вернуть"),
      run: () => void restore("medicine_courses", course.id),
    });
  }

  /**
   * Завершить — обычный конец курса, поэтому первой кнопкой и во всю ширину.
   * Курс уезжает в список законченных; «Вернуть» в тосте возвращает.
   */
  async function finish(course: MedicineCourse) {
    setOpen(null);
    await save("medicine_courses", { ...course, ended_at: nowISO() });
    showToast(t("Курс завершён"), {
      label: t("Вернуть"),
      run: () => void save("medicine_courses", { ...course, ended_at: null }),
    });
  }

  async function resume(course: MedicineCourse) {
    setOpen(null);
    await save("medicine_courses", { ...course, ended_at: null });
  }

  /**
   * Левая часть плашки: с какого дня идёт курс и что дали — в тот день,
   * который отлистан под плашкой. Сегодня — со словом «сегодня» и срок;
   * прошлый день — просто его выдачи, день и так написан под плашкой.
   */
  function givenText(status: CourseStatus, viewStart: number): string {
    // Дата начала — только если курс начат не сегодня: иначе она ничего не
    // добавляет, а место в строке дорого.
    const since =
      dayKey(status.course.started_at) === dayKey(new Date(now))
        ? ""
        : `${t("с {0}", [formatDayDate(status.course.started_at)])} · `;

    if (viewStart !== startOfDay(now)) {
      const given = dosesOfDay(status.course, doses, viewStart);
      const planned = slotsForDay(status.course, doses, viewStart, now).length;
      if (given.length === 0) {
        return since + t("не давали · 0 из {0}", [planned]);
      }
      const last = Math.max(...given.map(({ at }) => at));
      return (
        since +
        t("дали в {0} · {1} из {2}", [
          formatTime(new Date(last)),
          given.length,
          planned,
        ])
      );
    }

    if (status.expired) {
      return since + t("срок вышел — завершите курс или продлите");
    }
    if (status.lastGivenAt === null) return since + t("сегодня ещё не давали");
    return (
      since +
      t("дали в {0} · сегодня {1} из {2}", [
        formatTime(new Date(status.lastGivenAt)),
        status.givenToday,
        status.planned,
      ])
    );
  }

  /** Подпись под крупным временем справа: когда следующий. */
  function whenText(status: CourseStatus): string {
    if (status.due) return t("пора дать");
    if (status.doneToday) return t("завтра");
    return t("через {0}", [formatDuration(status.nextAt - now)]);
  }

  /** «день 3 из 7» — у курса со сроком; после срока — просто срок. */
  const dayOf = (status: CourseStatus) => {
    const days = courseDays(status.course);
    if (status.dayIndex === null || days === null) return "";
    return ` · ${t("день {0} из {1}", [Math.min(status.dayIndex, days), days])}`;
  };

  /**
   * Под раскрытым курсом: завершить или вернуть — во всю ширину, под ними
   * правка и удаление. Три кнопки в ряд на телефоне не помещаются.
   */
  const details = (course: MedicineCourse) => (
    <div className={styles.details}>
      {course.ended_at === null && (
        <div className={styles.pinRow}>
          <span className={styles.pinText}>
            <span className={styles.pinLabel}>{t("На главном экране")}</span>
            <span className={styles.pinHint}>
              {t("компактная карточка под таймером сна")}
            </span>
          </span>
          <Switch
            checked={Boolean(course.pinned)}
            onChange={(next) => void setCoursePinned(course, next)}
            label={t("На главном экране")}
          />
        </div>
      )}
      {course.ended_at === null ? (
        <Button variant="secondary" block onClick={() => finish(course)}>
          <Icon name="check" size={16} />
          {t("Завершить курс")}
        </Button>
      ) : (
        <Button variant="secondary" block onClick={() => resume(course)}>
          {t("Вернуть курс")}
        </Button>
      )}
      <div className={styles.detailsRow}>
        <Button variant="secondary" onClick={() => openEdit(course)}>
          <Icon name="pencil" size={16} />
          {t("Изменить")}
        </Button>
        <Button variant="danger" onClick={() => remove(course)}>
          <Icon name="trash" size={16} />
          {t("Удалить")}
        </Button>
      </div>
    </div>
  );

  /** Шеврон в правом краю плашки — знак, что она раскрывается. Не кнопка:
      кнопка — вся плашка, вкладывать одну в другую нельзя. */
  const chevron = (id: string) => (
    <span
      className={`${styles.chevron} ${open === id ? styles.chevronOpen : ""}`}
      aria-hidden="true"
    >
      <Icon name="chevron-down" size={16} />
    </span>
  );

  const addButton = (
    <Button size="sm" variant="ghost" onClick={openNew}>
      <Icon name="plus" size={16} />
      {t("Добавить")}
    </Button>
  );

  return (
    <>
      <Card title={t("Лекарства")} action={empty ? undefined : addButton}>
        {statuses.length === 0 && (
          <p className={styles.lead}>
            {t("Курс лекарства: название, доза и во сколько давать. Приложение подскажет следующий приём, напомнит и запишет выдачу одним нажатием.")}
          </p>
        )}

        {statuses.map((status) => {
          const id = status.course.id;
          const back = shiftOf(id);
          const maxBack = daysBackAvailable(status.course, now);
          const viewStart = dayStartBack(now, back);
          // Сегодня — пилюли из статуса, с подсветкой следующего; прошлый
          // день — просто его приёмы и выдачи.
          const slots =
            back === 0
              ? status.slots
              : slotsForDay(status.course, doses, viewStart, now);

          return (
          <div key={id} className={styles.course}>
            <button
              type="button"
              className={[
                styles.badge,
                status.due ? styles.badgeDue : "",
                status.expired ? styles.badgeExpired : "",
              ]
                .filter(Boolean)
                .join(" ")}
              aria-expanded={open === status.course.id}
              onClick={() => toggleOpen(status.course.id)}
            >
              <span className={styles.badgeText}>
                <span className={styles.badgeTitle}>
                  {courseTitle(status.course)}
                  {dayOf(status)}
                </span>
                <span className={styles.badgeSub}>
                  {givenText(status, viewStart)}
                </span>
              </span>
              {/* Следующий приём — только у сегодняшнего дня: у вчерашнего
                  ничего не ждёт. */}
              {!status.expired && back === 0 && (
                <span className={styles.badgeNext}>
                  <span className={`${styles.badgeTime} tnum`}>
                    {formatTime(new Date(status.nextAt))}
                  </span>
                  <span className={styles.badgeWhen}>{whenText(status)}</span>
                </span>
              )}
              {chevron(status.course.id)}
            </button>

            <DayNav
              back={back}
              maxBack={maxBack}
              dayStart={viewStart}
              onChange={(value) => setShiftOf(id, value)}
              className={styles.dayNav}
            />

            {/* После срока пилюль на сегодня нет: приёмов в плане не было. */}
            {slots.length > 0 && (
            <div className={styles.slots}>
                {slots.map((slot) => (
                  <button
                    key={slot.time}
                    type="button"
                    aria-pressed={slot.given}
                    disabled={!canToggleSlot(slot, now)}
                    className={[
                      styles.slot,
                      slot.given ? styles.slotGiven : "",
                      slot.next ? styles.slotNext : "",
                      slot.next && status.due ? styles.slotDue : "",
                      slot.past ? styles.slotPast : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onClick={() => toggleSlot(status, slot)}
                  >
                    {slot.given && <Icon name="check" size={15} />}
                    {slot.time}
                  </button>
                ))}
            </div>
            )}

            {status.course.note && (
              <p className={styles.note}>{status.course.note}</p>
            )}
            {open === id && details(status.course)}
          </div>
          );
        })}

        {empty && (
          <div className={styles.actions}>
            <Button variant="secondary" size="lg" onClick={openNew}>
              <Icon name="plus" size={18} />
              {t("Добавить лекарство")}
            </Button>
          </div>
        )}

        {finished.length > 0 && (
          <div className={styles.finished}>
            <h3 className={styles.finishedTitle}>{t("Закончены")}</h3>
            {finished.map((course) => (
              <div key={course.id} className={styles.finishedItem}>
                <button
                  type="button"
                  className={styles.finishedRow}
                  aria-expanded={open === course.id}
                  onClick={() => toggleOpen(course.id)}
                >
                  <span className={styles.finishedName}>
                    {courseTitle(course)}
                  </span>
                  <span className={styles.finishedWhen}>
                    {t("до {0}", [formatDate(course.ended_at as string)])}
                  </span>
                  {chevron(course.id)}
                </button>
                {open === course.id && details(course)}
              </div>
            ))}
          </div>
        )}
      </Card>

      {editorOpen && (
        <MedicineCourseEditor
          key={picked?.id ?? "new-course"}
          open={editorOpen}
          onClose={() => setEditorOpen(false)}
          childId={childId}
          course={picked ?? undefined}
        />
      )}
    </>
  );
}
