import { t } from "../../lib/i18n";
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
  /**
   * Откуда выезжает. Снизу — обычная шторка; сверху — выпадает из-под шапки,
   * для того, что открывают из шапки: список малышей. Закрывается свайпом в
   * ту же сторону, откуда пришла.
   */
  side?: "bottom" | "top";
  children: ReactNode;
}

export function Sheet({
  open,
  onClose,
  title,
  subtitle,
  side = "bottom",
  children,
}: SheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState(0);
  const [settling, setSettling] = useState(false);
  // Направление закрытия: снизу — вниз (+1), сверху — вверх (−1). Вся
  // геометрия свайпа умножается на него, остальное одинаково.
  const dir = side === "top" ? -1 : 1;

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Пока открыта шторка, нижняя навигация прячется (см. AppShell): в iOS
    // при открытой клавиатуре всё, что прижато к низу через position: fixed,
    // всплывает над клавиатурой и торчит сквозь затемнение. Счётчик, а не
    // флаг: шторки бывают вложенными, и закрытие одной не должно возвращать
    // навигацию, пока открыта другая.
    const body = document.body;
    body.dataset.sheets = String(Number(body.dataset.sheets ?? 0) + 1);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      const left = Number(body.dataset.sheets ?? 1) - 1;
      if (left <= 0) delete body.dataset.sheets;
      else body.dataset.sheets = String(left);
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
      // Положительная delta — движение в сторону закрытия.
      const delta = (y - startY) * dir;

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
      if (elapsed > 0) velocity = ((y - lastY) * dir) / elapsed;
      lastY = y;
      lastAt = event.timeStamp;

      apply(delta * RESISTANCE * dir);
    };

    const onEnd = () => {
      startY = null;
      if (!dragging) return;

      dragging = false;
      setSettling(true);

      if (current * dir >= CLOSE_DISTANCE || velocity >= CLOSE_VELOCITY) {
        apply(dir * (panel.getBoundingClientRect().height + 48));
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
  }, [open, onClose, dir]);

  if (!open) return null;

  const top = side === "top";

  return createPortal(
    <div
      className={`${styles.overlay} ${top ? styles.overlayTop : ""}`}
      style={{
        backgroundColor: `rgba(0, 0, 0, ${(
          0.55 *
          (1 - Math.min(0.8, Math.abs(offset) / 420))
        ).toFixed(3)})`,
      }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        className={[
          styles.panel,
          top ? styles.panelTop : "",
          settling ? styles.settling : "",
        ]
          .filter(Boolean)
          .join(" ")}
        style={offset ? { transform: `translateY(${offset}px)` } : undefined}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === "string" ? title : undefined}
        data-testid="sheet-panel"
        data-offset={Math.round(offset)}
      >
        {!top && <div className={styles.grabber} />}
        <div className={styles.header}>
          <div>
            <h2 className={styles.title}>{title}</h2>
            {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
          </div>
          <button
            type="button"
            className={styles.close}
            onClick={onClose}
            aria-label={t("Закрыть")}
          >
            <Icon name="close" size={18} />
          </button>
        </div>
        {children}
        {/* У верхней шторки ручка снизу: тянут за нижний край, вверх. */}
        {top && <div className={`${styles.grabber} ${styles.grabberBottom}`} />}
      </div>
    </div>,
    document.body,
  );
}
