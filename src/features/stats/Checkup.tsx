import { useState } from "react";
import { Icon } from "../../components/ui/Icon";
import type { Checkup as CheckupData } from "./checkupData";
import styles from "./Checkup.module.css";

const TONE = {
  ok: styles.ok,
  attention: styles.attention,
  unknown: styles.unknown,
} as const;

export function Checkup({ data }: { data: CheckupData }) {
  const [open, setOpen] = useState(false);

  return (
    <div className={`${styles.card} ${TONE[data.status]}`}>
      <button
        type="button"
        className={styles.head}
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <span className={styles.title}>Развитие ребёнка</span>

        <span className={styles.verdict}>
          <i className={styles.dot} />
          {data.headline}
        </span>

        <span className={styles.sub}>
          {data.sub}
          <span
            className={`${styles.chevron} ${open ? styles.chevronOpen : ""}`}
            aria-hidden="true"
          >
            <Icon name="chevron-down" size={16} />
          </span>
        </span>
      </button>

      {open && (
        <div className={styles.body}>
          <ul className={styles.list}>
            {data.rows.map((row) => (
              <li key={row.label} className={styles.row}>
                <span className={`${styles.mark} ${TONE[row.status]}`}>
                  {row.status === "ok"
                    ? "✓"
                    : row.status === "attention"
                      ? "!"
                      : "—"}
                </span>
                <span className={styles.rowText}>
                  <span className={styles.rowLabel}>{row.label}</span>
                  <span className={styles.rowValue}>{row.value}</span>
                  <span className={styles.rowDetail}>{row.detail}</span>
                </span>
              </li>
            ))}
          </ul>

          <p className={styles.disclaimer}>
            Это не медицинская оценка. Приложение только сверяет ваши записи с
            таблицами ВОЗ и возрастными ориентирами сна. Вопросы здоровья решает
            педиатр.
          </p>
        </div>
      )}
    </div>
  );
}
