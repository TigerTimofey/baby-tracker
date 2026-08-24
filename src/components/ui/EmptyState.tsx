import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icon";
import styles from "./EmptyState.module.css";

interface EmptyStateProps {
  icon: IconName;
  title: ReactNode;
  text?: ReactNode;
  action?: ReactNode;
}

export function EmptyState({ icon, title, text, action }: EmptyStateProps) {
  return (
    <div className={styles.wrap}>
      <span className={styles.icon}>
        <Icon name={icon} size={26} />
      </span>
      <h3 className={styles.title}>{title}</h3>
      {text && <p className={styles.text}>{text}</p>}
      {action}
    </div>
  );
}
