import type { HTMLAttributes, ReactNode } from "react";
import styles from "./Card.module.css";

// `title` перекрываем: у div это всплывающая подсказка, а нам нужен заголовок.
interface CardProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  /** Заголовок-надпись над содержимым. */
  title?: ReactNode;
  action?: ReactNode;
  /** Убрать внутренние отступы — для списков во всю ширину. */
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
