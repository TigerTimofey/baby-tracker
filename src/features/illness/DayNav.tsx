import { t } from "../../lib/i18n";
import { Icon } from "../../components/ui/Icon";
import { formatDayLabel } from "../../lib/time";
import styles from "./DayNav.module.css";

interface DayNavProps {
  /** На сколько дней назад отлистано: 0 — сегодня. */
  back: number;
  /** Дальше этого назад не уйти: там курса ещё не было. */
  maxBack: number;
  /** Начало отлистанных суток — для подписи. */
  dayStart: number;
  onChange: (back: number) => void;
  className?: string;
}

/** «‹ Вчера ›»: стрелки по дням, в будущее нельзя, раньше начала — тоже. */
export function DayNav({ back, maxBack, dayStart, onChange, className }: DayNavProps) {
  return (
    <div className={[styles.nav, className ?? ""].filter(Boolean).join(" ")}>
      <button
        type="button"
        className={styles.btn}
        disabled={back >= maxBack}
        onClick={() => onChange(Math.min(maxBack, back + 1))}
        aria-label={t("Предыдущий день")}
      >
        <Icon name="chevron-left" size={18} />
      </button>
      <span className={styles.label}>{formatDayLabel(new Date(dayStart))}</span>
      <button
        type="button"
        className={styles.btn}
        disabled={back === 0}
        onClick={() => onChange(Math.max(0, back - 1))}
        aria-label={t("Следующий день")}
      >
        <Icon name="chevron-right" size={18} />
      </button>
    </div>
  );
}
