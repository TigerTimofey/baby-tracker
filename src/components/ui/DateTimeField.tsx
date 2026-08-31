import { t } from "../../lib/i18n";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import styles from "./DateTimeField.module.css";
import formStyles from "./Form.module.css";

interface DateTimeFieldProps {
  label: ReactNode;
  hint?: ReactNode;
  /** Формат "2026-08-24T18:14". Пустая строка — значение не задано. */
  value: string;
  onChange: (value: string) => void;
  max?: string;
  /** Какой датой достроить, если человек ввёл только время. */
  defaultDate?: string;
}

function split(value: string): { date: string; time: string } {
  const [date = "", time = ""] = value.split("T");
  return { date, time: time.slice(0, 5) };
}

export function DateTimeField({
  label,
  hint,
  value,
  onChange,
  max,
  defaultDate,
}: DateTimeFieldProps) {
  const id = useId();
  const timeRef = useRef<HTMLInputElement>(null);

  // Половинку ввода держим у себя: раньше время без даты просто выбрасывалось,
  // и поле оставалось пустым, как будто нажатие не сработало.
  const [draft, setDraft] = useState(() => split(value));
  useEffect(() => setDraft(split(value)), [value]);
  const { date, time } = draft;

  /** Дата выбрана — сразу зовём выбрать время, иначе запись остаётся неполной. */
  const askForTime = () => {
    requestAnimationFrame(() => {
      const node = timeRef.current;
      if (!node) return;
      node.focus();
      try {
        node.showPicker?.();
      } catch {
        // Некоторые браузеры открывают выбор только по прямому нажатию —
        // тогда достаточно фокуса.
      }
    });
  };

  const emit = (nextDate: string, nextTime: string) => {
    setDraft({ date: nextDate, time: nextTime });
    onChange(nextDate && nextTime ? `${nextDate}T${nextTime}` : "");
  };

  const maxDate = max ? split(max).date : undefined;

  return (
    <div className={formStyles.field}>
      <label className={formStyles.label} htmlFor={id}>
        {label}
      </label>

      <div className={styles.pair}>
        <input
          id={id}
          className={styles.input}
          type="date"
          value={date}
          max={maxDate}
          onChange={(event) => {
            emit(event.target.value, time);
            if (event.target.value && !time) askForTime();
          }}
        />
        <input
          ref={timeRef}
          className={styles.input}
          type="time"
          value={time}
          aria-label={t("Время")}
          onChange={(event) =>
            emit(date || defaultDate || "", event.target.value)
          }
        />
      </div>

      {hint && <span className={formStyles.hint}>{hint}</span>}
    </div>
  );
}
