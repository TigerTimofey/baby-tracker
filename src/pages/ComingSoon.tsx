import { Icon, type IconName } from "../components/ui/Icon";
import styles from "./ComingSoon.module.css";

export interface PlannedItem {
  title: string;
  text: string;
}

interface ComingSoonProps {
  icon: IconName;
  title: string;
  text: string;
  items: PlannedItem[];
}

/**
 * Раздел, который ещё не сделан. Показываем не пустоту, а что именно
 * здесь появится — так видно, куда движется приложение.
 */
export function ComingSoon({ icon, title, text, items }: ComingSoonProps) {
  return (
    <div className={styles.wrap}>
      <div className={styles.hero}>
        <span className={styles.icon}>
          <Icon name={icon} size={28} />
        </span>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.text}>{text}</p>
      </div>

      <div className={styles.list}>
        {items.map((item) => (
          <div key={item.title} className={styles.item}>
            <span className={styles.bullet} />
            <div>
              <div className={styles.itemTitle}>{item.title}</div>
              <div className={styles.itemText}>{item.text}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
