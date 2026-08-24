import styles from "./Facts.module.css";

export interface Fact {
  label: string;
  value: string | null;
  hint?: string;
}

export function Facts({ items }: { items: Fact[] }) {
  const known = items.filter((item) => item.value !== null);
  if (known.length === 0) return null;

  return (
    <div className={styles.list}>
      {known.map((item) => (
        <div key={item.label} className={styles.row}>
          <span className={styles.text}>
            <span className={styles.label}>{item.label}</span>
            {item.hint && <span className={styles.hint}>{item.hint}</span>}
          </span>
          <span className={`${styles.value} tnum`}>{item.value}</span>
        </div>
      ))}
    </div>
  );
}
