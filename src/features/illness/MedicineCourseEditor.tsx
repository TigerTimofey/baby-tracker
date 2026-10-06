import { t } from "../../lib/i18n";
import { useState, type FormEvent } from "react";
import { Button } from "../../components/ui/Button";
import dateStyles from "../../components/ui/DateTimeField.module.css";
import { Field, FormActions, TextInput } from "../../components/ui/Form";
import { Segmented } from "../../components/ui/Segmented";
import { Sheet } from "../../components/ui/Sheet";
import { showToast } from "../../components/ui/toast";
import { newId, nowISO, restore, save, softDelete } from "../../data/repo";
import type { DoseUnit, MedicineCourse } from "../../data/types";
import { dayKey } from "../../lib/time";
import {
  MAX_TIMES,
  defaultTimes,
  resizeTimes,
  sortTimes,
} from "./courseUtils";
import { UNITS, formatDose, unitLabel } from "./medUtils";
import styles from "./MedicineCourseEditor.module.css";

const MAX_AMOUNT = 10_000;
const DEFAULT_COUNT = 3;
const COUNTS = Array.from({ length: MAX_TIMES }, (_, index) =>
  String(index + 1),
);

/** Ходовые сроки курса; «∞» — без срока, пока не завершат вручную. */
const OPEN_ENDED = "inf";
const DAY_OPTIONS = [OPEN_ENDED, "3", "5", "7", "10", "14"];
const MAX_DAYS = 365;

interface MedicineCourseEditorProps {
  open: boolean;
  onClose: () => void;
  childId: string;
  course?: MedicineCourse;
  /** Повторить курс: поля заполнены с этого, но сохранится новый, с сегодня. */
  copyOf?: MedicineCourse;
}

/**
 * Курс лекарства: название и доза — руками, их знает только родитель;
 * расписание — числом приёмов и временем каждого. Приложение ничего не
 * подставляет само, кроме ходового расписания на выбранное число приёмов.
 *
 * Автофокуса на названии нет нарочно. В iOS программный фокус заставляет
 * Safari прокрутить страницу, чтобы показать поле над клавиатурой, — и после
 * закрытия шторки нижняя панель оставалась не у края. У шторки кормления,
 * где ничего не фокусируется само, этого никогда не было.
 */
export function MedicineCourseEditor({
  open,
  onClose,
  childId,
  course,
  copyOf,
}: MedicineCourseEditorProps) {
  // Откуда брать начальные значения полей: правка — из курса, повтор — из
  // образца. Дата начала и срок у повтора свои: он начинается сегодня.
  const seed = course ?? copyOf;
  const [name, setName] = useState(seed?.name ?? "");
  const [amount, setAmount] = useState(
    seed?.amount == null ? "" : formatDose(seed.amount),
  );
  const [unit, setUnit] = useState<DoseUnit>(seed?.unit ?? "ml");
  // Дата начала: по умолчанию сегодня. Курс, начатый вчера и заведённый
  // только сегодня, ставят задним числом — тогда и день курса, и ожидание
  // приёмов считаются с той даты.
  const [startDate, setStartDate] = useState(
    dayKey(course?.started_at ?? new Date()),
  );
  const [times, setTimes] = useState<string[]>(
    seed && seed.times.length > 0
      ? sortTimes(seed.times)
      : defaultTimes(DEFAULT_COUNT),
  );
  // Срок — кнопкой из ходовых или своим числом в поле ниже. Два состояния,
  // а не одно: пока родитель набирает «7» в поле, кнопка «7» не должна
  // перехватывать выбор и очищать поле у него под пальцами.
  const initialDays = seed?.days ?? null;
  const [preset, setPreset] = useState(
    initialDays !== null && DAY_OPTIONS.includes(String(initialDays))
      ? String(initialDays)
      : OPEN_ENDED,
  );
  const [custom, setCustom] = useState(
    initialDays !== null && !DAY_OPTIONS.includes(String(initialDays))
      ? String(initialDays)
      : "",
  );
  const [error, setError] = useState<string | null>(null);

  function setCount(value: string) {
    setTimes(resizeTimes(times, Number(value)));
  }

  function setTime(index: number, value: string) {
    setTimes(times.map((time, at) => (at === index ? value : time)));
  }


  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    const title = name.trim();
    if (!title) {
      setError(t("Напишите название лекарства"));
      return;
    }

    const raw = amount.trim();
    if (raw === "") {
      setError(t("Укажите дозу на приём"));
      return;
    }
    const parsed = Number(raw.replace(",", "."));
    if (!Number.isFinite(parsed) || parsed <= 0 || parsed > MAX_AMOUNT) {
      setError(t("Количество похоже на опечатку"));
      return;
    }

    if (times.some((time) => !time)) {
      setError(t("Укажите время каждого приёма"));
      return;
    }
    if (new Set(times).size !== times.length) {
      setError(t("Время приёмов повторяется"));
      return;
    }

    if (!startDate) {
      setError(t("Укажите дату начала"));
      return;
    }
    const today = dayKey(new Date());
    if (startDate > today) {
      setError(t("Начало в будущем"));
      return;
    }
    // Та же дата, что была, — время начала не трогаем. Другая — с начала тех
    // суток, чтобы все приёмы того дня считались. Новый курс «с сегодня»
    // начинается прямо сейчас: утренних приёмов, которых не было в плане,
    // он не требует.
    let startedAt: string;
    if (course && dayKey(course.started_at) === startDate) {
      startedAt = course.started_at;
    } else if (!course && startDate === today) {
      startedAt = nowISO();
    } else {
      const [year, month, day] = startDate.split("-").map(Number);
      startedAt = new Date(year, month - 1, day, 0, 0, 0, 0).toISOString();
    }

    let daysValue: number | null;
    if (custom.trim() !== "") {
      const parsed = Number(custom.trim());
      if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_DAYS) {
        setError(t("Срок похож на опечатку"));
        return;
      }
      daysValue = parsed;
    } else {
      daysValue = preset === OPEN_ENDED ? null : Number(preset);
    }

    await save("medicine_courses", {
      id: course?.id ?? newId(),
      child_id: childId,
      name: title,
      amount: Math.round(parsed * 100) / 100,
      unit,
      times: sortTimes(times),
      days: daysValue,
      pinned: course?.pinned ?? false,
      // Поля примечания в шторке больше нет; старые примечания не теряем.
      note: course?.note ?? null,
      started_at: startedAt,
      // Завершают и возвращают курс кнопками в карточке; правка этого не трогает.
      ended_at: course?.ended_at ?? null,
      updated_at: nowISO(),
      deleted: false,
      created_by: course?.created_by ?? null,
    });
    onClose();
  }

  async function handleDelete() {
    if (!course) return;
    await softDelete("medicine_courses", course.id);
    onClose();
    showToast(t("Курс удалён"), {
      label: t("Вернуть"),
      run: () => void restore("medicine_courses", course.id),
    });
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      side="center"
      title={course ? t("Курс лекарства") : t("Новый курс")}
    >
      {/* Форма уложена так, чтобы помещаться на экран телефона без внутренней
          прокрутки, как шторка измерения: в iOS поле ввода внутри
          прокручиваемой панели заставляет Safari прокрутить и окно, и после
          клавиатуры страница остаётся сдвинутой. Поля даты и времени — те же,
          что в DateTimeField, один в один. */}
      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.pair}>
          <Field label={t("Название")}>
            {(id) => (
              <TextInput
                id={id}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={t("Например, Амоксициллин")}
                autoComplete="off"
              />
            )}
          </Field>

          <Field label={t("Доза на приём")}>
            {(id) => (
              <TextInput
                id={id}
                inputMode="decimal"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder={t("2,5")}
                suffix={unitLabel(unit)}
              />
            )}
          </Field>
        </div>

        <div className={styles.half}>
          <Field label={t("Единицы")}>
            {(id) => (
              <Segmented<DoseUnit>
                id={id}
                value={unit}
                onChange={setUnit}
                ariaLabel={t("Единицы")}
                options={UNITS.map((item) => ({
                  value: item,
                  label: unitLabel(item),
                }))}
              />
            )}
          </Field>

          <Field label={t("Начало курса")}>
            {(id) => (
              <input
                id={id}
                className={dateStyles.input}
                type="date"
                value={startDate}
                max={dayKey(new Date())}
                onChange={(event) => setStartDate(event.target.value)}
              />
            )}
          </Field>
        </div>

        <Field label={t("Сколько раз в день")}>
          {(id) => (
            <Segmented
              id={id}
              value={String(times.length)}
              onChange={setCount}
              ariaLabel={t("Сколько раз в день")}
              options={COUNTS.map((item) => ({ value: item, label: item }))}
            />
          )}
        </Field>

        <Field label={t("Во сколько")}>
          {(id) => (
            <div id={id} className={styles.times}>
              {times.map((time, index) => (
                <input
                  key={index}
                  className={dateStyles.input}
                  type="time"
                  value={time}
                  onChange={(event) => setTime(index, event.target.value)}
                  aria-label={t("Приём {0}", [index + 1])}
                />
              ))}
            </div>
          )}
        </Field>

        <Field
          label={t("Сколько дней")}
          hint={t("∞ — без срока, пока не завершите сами")}
        >
          {(id) => (
            <div className={styles.days}>
              <Segmented
                id={id}
                value={custom.trim() !== "" ? "" : preset}
                onChange={(next) => {
                  setPreset(next);
                  setCustom("");
                }}
                ariaLabel={t("Сколько дней")}
                options={DAY_OPTIONS.map((item) => ({
                  value: item,
                  label: item === OPEN_ENDED ? "∞" : item,
                }))}
              />
              <TextInput
                inputMode="numeric"
                value={custom}
                onChange={(event) => setCustom(event.target.value)}
                placeholder={t("или своё число")}
                suffix={t("дн.")}
                aria-label={t("Своё число дней")}
              />
            </div>
          )}
        </Field>

        {error && <p className={styles.error}>{error}</p>}

        <FormActions>
          {course ? (
            <Button type="button" variant="ghost" onClick={handleDelete}>
              {t("Удалить")}
            </Button>
          ) : (
            <Button type="button" variant="secondary" onClick={onClose}>
              {t("Отмена")}
            </Button>
          )}
          <Button type="submit" variant="primary">
            {t("Сохранить")}
          </Button>
        </FormActions>
      </form>
    </Sheet>
  );
}
