import { useId, type ReactNode } from "react";
import styles from "./DateTimeField.module.css";
import formStyles from "./Form.module.css";

interface DateTimeFieldProps {
  label: ReactNode;
  hint?: ReactNode;
  /** Формат "2026-08-24T18:14". Пустая строка — значение не задано. */
  value: string;
  onChange: (value: string) => void;
  max?: string;
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
}: DateTimeFieldProps) {
  const id = useId();
  const { date, time } = split(value);

  const emit = (nextDate: string, nextTime: string) => {
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
          onChange={(event) => emit(event.target.value, time || "12:00")}
        />
        <input
          className={styles.input}
          type="time"
          value={time}
          aria-label="Время"
          onChange={(event) => emit(date, event.target.value)}
        />
      </div>

      {hint && <span className={formStyles.hint}>{hint}</span>}
    </div>
  );
}
