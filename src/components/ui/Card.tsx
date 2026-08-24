import type { HTMLAttributes, ReactNode } from "react";
import styles from "./Card.module.css";

interface CardProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  title?: ReactNode;
  action?: ReactNode;
  flush?: boolean;
}

export function Card({
  title,
  action,
  flush = false,
  className,
  children,
  ...rest
}: CardProps) {
  return (
    <div
      className={[styles.card, flush ? styles.flush : "", className ?? ""]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      {(title || action) && (
        <div className={styles.header}>
          {title && <h2 className={styles.title}>{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </div>
  );
}
