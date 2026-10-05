import { newId, nowISO, save, softDelete } from "../../data/repo";
import type { Medicine, MedicineCourse } from "../../data/types";
import {
  doseTimeForSlot,
  type CourseSlot,
  type CourseStatus,
} from "./courseUtils";

/** Выдача по курсу: название, доза и единицы — из него, время — заданное. */
export async function recordCourseDose(
  childId: string,
  course: MedicineCourse,
  at: number,
): Promise<Medicine> {
  const record: Medicine = {
    id: newId(),
    child_id: childId,
    given_at: new Date(at).toISOString(),
    name: course.name,
    amount: course.amount,
    unit: course.unit,
    note: null,
    updated_at: nowISO(),
    deleted: false,
    created_by: null,
  };
  await save("medicines", record);
  return record;
}

/**
 * Пилюля приёма — переключатель. Нажали на отмеченную — снимается:
 * удаляются те выдачи, что на неё легли. Нажали на пустую — записывается
 * выдача; каким временем, решает doseTimeForSlot. Без тоста: отмена здесь —
 * ещё одно нажатие, а плашка внизу только мешала бы щёлкать по ряду.
 *
 * Одна функция на карточку «Аптечки» и на компактную карточку главного
 * экрана: правило одно, и расходиться им нельзя.
 */
export async function toggleCourseSlot(
  childId: string,
  status: CourseStatus,
  slot: CourseSlot,
): Promise<void> {
  if (slot.given) {
    await Promise.all(slot.doseIds.map((id) => softDelete("medicines", id)));
    return;
  }
  const at = doseTimeForSlot(status, slot, new Date().getTime());
  if (at === null) return;
  await recordCourseDose(childId, status.course, at);
}

export async function setCoursePinned(
  course: MedicineCourse,
  pinned: boolean,
): Promise<void> {
  await save("medicine_courses", { ...course, pinned });
}
