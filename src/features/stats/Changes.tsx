import { t } from "../../lib/i18n";
import type { Changes as ChangesData } from "./changesData";
import styles from "./Changes.module.css";

const ARROW = { up: "↑", down: "↓", flat: "=" } as const;

export function Changes({ data }: { data: ChangesData }) {
  if (data.rows.length === 0) {
    return <p className={styles.basis}>{data.shortfall}</p>;
  }

  return (
    <>
      <ul className={styles.list}>
        {data.rows.map((row) => (
          <li key={row.label} className={styles.row}>
            <div className={styles.head}>
              <span className={styles.label}>{row.label}</span>
              <span className={styles.change}>
                <span className={styles.arrow} aria-hidden="true">
                  {ARROW[row.direction]}
                </span>
                <span className="tnum">{row.change}</span>
              </span>
            </div>
            <p className={styles.detail}>
              <span className="tnum">{row.before}</span>
              <span className={styles.to} aria-hidden="true">
                →
              </span>
              <span className="tnum">{row.after}</span>
              <span className={styles.dot}>·</span>
              {row.basis}
            </p>
          </li>
        ))}
      </ul>

      {data.shortfall && <p className={styles.basis}>{data.shortfall}</p>}

      <p className={styles.basis}>
        {t("Сравниваются два соседних отрезка одинаковой длины. Сегодняшний день не\n        учитывается — он ещё не закончился. Показатель появляется, только если\n        записей хватает в обоих отрезках; рядом всегда написано, по скольким.")}
      </p>
    </>
  );
}
