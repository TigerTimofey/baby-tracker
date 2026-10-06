import { t } from "../../lib/i18n";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Icon } from "./Icon";
import styles from "./Sheet.module.css";

const CLOSE_DISTANCE = 110;
const CLOSE_VELOCITY = 0.5;
const RESISTANCE = 0.85;
const START_SLOP = 8;
const EXIT_MS = 190;
const INTERACTIVE = "input, textarea, select, button, [role='tab'], a";

/** Прокрутка страницы на момент, когда открылась первая шторка. */
let lockedScrollY = 0;

/**
 * Замок прокрутки страницы на время шторки.
 *
 * overflow: hidden на body в iOS не держит: когда клавиатура подводит поле к
 * экрану, Safari прокручивает всю страницу, и после закрытия шторки она
 * остаётся сдвинутой — навигация, прибитая к низу через position: fixed,
 * висит не у края. Поэтому body фиксируется на месте с отрицательным top:
 * документ становится ростом с экран, прокручивать нечего, а при закрытии
 * прокрутка возвращается туда, где была. Счётчик, а не флаг: шторки бывают
 * вложенными, замок ставит первая и снимает последняя.
 */
function lockPage(hideNav: boolean): () => void {
  const body = document.body;
  const count = Number(body.dataset.sheets ?? 0);
  // Панель навигации прячется только под шторками, которые её закрывают:
  // выезжающими снизу, сверху и во весь экран. Окно по центру стоит между
  // шапкой и панелью, и обе должны остаться на месте.
  if (hideNav) {
    body.dataset.navHidden = String(Number(body.dataset.navHidden ?? 0) + 1);
  }
  if (count === 0) {
    lockedScrollY = window.scrollY;
    body.style.position = "fixed";
    body.style.top = `-${lockedScrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";
    body.style.overflow = "hidden";
  }
  body.dataset.sheets = String(count + 1);

  return () => {
    if (hideNav) {
      const hidden = Number(body.dataset.navHidden ?? 1) - 1;
      if (hidden <= 0) delete body.dataset.navHidden;
      else body.dataset.navHidden = String(hidden);
    }
    const left = Number(body.dataset.sheets ?? 1) - 1;
    if (left > 0) {
      body.dataset.sheets = String(left);
      return;
    }
    delete body.dataset.sheets;
    body.style.position = "";
    body.style.top = "";
    body.style.left = "";
    body.style.right = "";
    body.style.width = "";
    body.style.overflow = "";
    window.scrollTo(0, lockedScrollY);
    // Ещё раз на следующем кадре: iOS дорисовывает уход клавиатуры уже после
    // закрытия шторки и может сдвинуть страницу снова.
    window.requestAnimationFrame(() => window.scrollTo(0, lockedScrollY));
  };
}

/**
 * Сдвиг страницы после клавиатуры в iOS. Пока открыта шторка, body закреплён
 * и документ ростом с экран, так что любая прокрутка окна — перетяг за край,
 * который Safari оставляет после клавиатуры; прокрутка в ноль возвращает
 * экран на место. Вызывается, когда клавиатура закрылась (высота визуального
 * вьюпорта вернулась к полной) и когда поле потеряло фокус.
 */
function realignAfterKeyboard(): () => void {
  const viewport = window.visualViewport;
  const reset = () => window.scrollTo(0, 0);
  const onResize = () => {
    if (!viewport || viewport.height >= window.innerHeight - 1) reset();
  };
  const onFocusOut = () => {
    window.setTimeout(reset, 60);
  };
  viewport?.addEventListener("resize", onResize);
  document.addEventListener("focusout", onFocusOut);
  return () => {
    viewport?.removeEventListener("resize", onResize);
    document.removeEventListener("focusout", onFocusOut);
  };
}

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  /**
   * Откуда выезжает. Снизу — обычная шторка; сверху — выпадает из-под шапки,
   * для того, что открывают из шапки: список малышей. Закрывается свайпом в
   * ту же сторону, откуда пришла. «full» — во весь экран, как отдельное окно.
   * «center» — окно по центру между шапкой и панелью навигации, шапка
   * остаётся видна и работает. Эти два свайпом не закрываются, только
   * крестиком, «Отменой» и Escape.
   */
  side?: "bottom" | "top" | "full" | "center";
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

  // Layout-эффект, а не обычный: замок должен встать до первой отрисовки
  // шторки. Если внутри неё поле с автофокусом, iOS начинает прокручивать
  // страницу сразу после отрисовки — обычный эффект успел бы захватить уже
  // сдвинутую прокрутку и вернул бы её при закрытии.
  useLayoutEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);

    // Замок прокрутки заодно ставит на body атрибут data-nav-hidden, по
    // которому AppShell прячет нижнюю навигацию: в iOS при открытой
    // клавиатуре всё, что прижато к низу через position: fixed, всплывает над
    // клавиатурой. Окно по центру панель не трогает.
    const unlock = lockPage(side !== "center");
    const stopRealign = realignAfterKeyboard();

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      stopRealign();
      unlock();
    };
  }, [open, onClose, side]);

  useEffect(() => {
    const panel = panelRef.current;
    if (!open || !panel) return;

    setOffset(0);
    setSettling(false);
    // Окно во весь экран или по центру свайпом не закрывается: тянуть его
    // некуда, а жест спорил бы с прокруткой длинной формы.
    if (side === "full" || side === "center") return;

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
  }, [open, onClose, dir, side]);

  if (!open) return null;

  const top = side === "top";
  const full = side === "full";
  const center = side === "center";

  return createPortal(
    <div
      className={[
        styles.overlay,
        top ? styles.overlayTop : "",
        full ? styles.overlayFull : "",
        center ? styles.overlayCenter : "",
      ]
        .filter(Boolean)
        .join(" ")}
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
          full ? styles.panelFull : "",
          center ? styles.panelCenter : "",
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
        {!top && !full && !center && <div className={styles.grabber} />}
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
