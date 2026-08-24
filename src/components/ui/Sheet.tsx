import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./Icon";
import styles from "./Sheet.module.css";

const CLOSE_DISTANCE = 110;
const CLOSE_VELOCITY = 0.5;
const RESISTANCE = 0.85;
const START_SLOP = 8;
const EXIT_MS = 190;
const INTERACTIVE = "input, textarea, select, button, [role='tab'], a";

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
}

export function Sheet({ open, onClose, title, subtitle, children }: SheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState(0);
  const [settling, setSettling] = useState(false);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  useEffect(() => {
    const panel = panelRef.current;
    if (!open || !panel) return;

    setOffset(0);
    setSettling(false);

    let startY: number | null = null;
    let dragging = false;
    let lastY = 0;
    let lastAt = 0;
    let velocity = 0;
    let current = 0;

    const apply = (value: number) => {
      current = value;
      setOffset(value);
    };

    const onStart = (event: TouchEvent) => {
      if (event.touches.length !== 1) {
        startY = null;
        return;
      }
      const target = event.target as HTMLElement | null;
      if (target?.closest(INTERACTIVE) || panel.scrollTop > 0) {
        startY = null;
        return;
      }
      startY = event.touches[0].clientY;
      lastY = startY;
      lastAt = event.timeStamp;
      velocity = 0;
      dragging = false;
      setSettling(false);
    };

    const onMove = (event: TouchEvent) => {
      if (startY === null) return;

      const y = event.touches[0].clientY;
      const delta = y - startY;

      if (delta <= 0) {
        if (dragging) {
          dragging = false;
          setSettling(true);
          apply(0);
        }
        startY = null;
        return;
      }

      if (!dragging) {
        if (delta < START_SLOP) return;
        dragging = true;
      }

      if (event.cancelable) event.preventDefault();

      const elapsed = event.timeStamp - lastAt;
      if (elapsed > 0) velocity = (y - lastY) / elapsed;
      lastY = y;
      lastAt = event.timeStamp;

      apply(delta * RESISTANCE);
    };

    const onEnd = () => {
      startY = null;
      if (!dragging) return;

      dragging = false;
      setSettling(true);

      if (current >= CLOSE_DISTANCE || velocity >= CLOSE_VELOCITY) {
        apply(panel.getBoundingClientRect().height + 48);
        window.setTimeout(onClose, EXIT_MS);
        return;
      }

      apply(0);
    };

    panel.addEventListener("touchstart", onStart, { passive: true });
    panel.addEventListener("touchmove", onMove, { passive: false });
    panel.addEventListener("touchend", onEnd, { passive: true });
    panel.addEventListener("touchcancel", onEnd, { passive: true });

    return () => {
      panel.removeEventListener("touchstart", onStart);
      panel.removeEventListener("touchmove", onMove);
      panel.removeEventListener("touchend", onEnd);
      panel.removeEventListener("touchcancel", onEnd);
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className={styles.overlay}
      style={{
        backgroundColor: `rgba(0, 0, 0, ${(
          0.55 *
          (1 - Math.min(0.8, offset / 420))
        ).toFixed(3)})`,
      }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        className={`${styles.panel} ${settling ? styles.settling : ""}`}
        style={offset ? { transform: `translateY(${offset}px)` } : undefined}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === "string" ? title : undefined}
        data-testid="sheet-panel"
        data-offset={Math.round(offset)}
      >
        <div className={styles.grabber} />
        <div className={styles.header}>
          <div>
            <h2 className={styles.title}>{title}</h2>
            {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
          </div>
          <button
            type="button"
            className={styles.close}
            onClick={onClose}
            aria-label="Закрыть"
          >
            <Icon name="close" size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}
