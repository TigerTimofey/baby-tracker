import { useState, type HTMLAttributes, type ReactNode } from "react";
import { Icon } from "./Icon";
import styles from "./Card.module.css";

interface CardProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  title?: ReactNode;
  action?: ReactNode;
  flush?: boolean;
  collapsible?: boolean;
  defaultOpen?: boolean;
}

export function Card({
  title,
  action,
  flush = false,
  collapsible = false,
  defaultOpen = false,
  className,
  children,
  ...rest
}: CardProps) {
  const [open, setOpen] = useState(defaultOpen);
  const shown = !collapsible || open;

  return (
    <div
      className={[
        styles.card,
        flush ? styles.flush : "",
        collapsible && !open ? styles.closed : "",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      {(title || action) && (
        <div className={styles.header}>
          {collapsible ? (
            <button
              type="button"
              className={`${styles.toggle} ${action ? styles.toggleTight : ""}`}
              onClick={() => setOpen(!open)}
              aria-expanded={open}
            >
              {title && <h2 className={styles.title}>{title}</h2>}
              <span
                className={`${styles.chevron} ${open ? styles.chevronOpen : ""}`}
                aria-hidden="true"
              >
                <Icon name="chevron-down" size={16} />
              </span>
            </button>
          ) : (
            title && <h2 className={styles.title}>{title}</h2>
          )}
          {action}
        </div>
      )}
      {shown && children}
    </div>
  );
}
