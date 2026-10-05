import { useEffect, useRef, useState } from "react";
import { Icon } from "./ui/Icon";
import styles from "./PullToRefresh.module.css";

const TRIGGER = 68;
const MAX = 104;
const RESISTANCE = 0.5;
const MIN_VISIBLE_MS = 550;

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
}

export function PullToRefresh({ onRefresh }: PullToRefreshProps) {
  const [pull, setPull] = useState(0);
  const [busy, setBusy] = useState(false);
  const [settling, setSettling] = useState(false);

  const startY = useRef<number | null>(null);
  const dragging = useRef(false);
  const pullRef = useRef(0);
  const busyRef = useRef(false);

  useEffect(() => {
    const apply = (value: number) => {
      pullRef.current = value;
      setPull(value);
    };

    const blocked = () =>
      busyRef.current || document.querySelector('[role="dialog"]') !== null;

    const onStart = (event: TouchEvent) => {
      if (blocked() || event.touches.length !== 1 || window.scrollY > 0) {
        startY.current = null;
        return;
      }
      startY.current = event.touches[0].clientY;
      dragging.current = false;
    };

    const onMove = (event: TouchEvent) => {
      if (startY.current === null) return;

      const delta = event.touches[0].clientY - startY.current;

      if (delta <= 0 || window.scrollY > 0) {
        if (dragging.current) {
          dragging.current = false;
          setSettling(true);
          apply(0);
        }
        startY.current = null;
        return;
      }

      if (!dragging.current) {
        if (delta < 10) return;
        dragging.current = true;
        setSettling(false);
      }

      if (event.cancelable) event.preventDefault();
      apply(Math.min(MAX, delta * RESISTANCE));
    };

    const onEnd = () => {
      startY.current = null;
      if (!dragging.current) return;

      dragging.current = false;
      setSettling(true);

      if (pullRef.current < TRIGGER) {
        apply(0);
        return;
      }

      busyRef.current = true;
      setBusy(true);
      apply(TRIGGER);

      void (async () => {
        const started = Date.now();
        try {
          await onRefresh();
        } catch {
          void 0;
        }
        const left = MIN_VISIBLE_MS - (Date.now() - started);
        if (left > 0) {
          await new Promise((resolve) => setTimeout(resolve, left));
        }
        busyRef.current = false;
        setBusy(false);
        apply(0);
      })();
    };

    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onEnd, { passive: true });
    window.addEventListener("touchcancel", onEnd, { passive: true });

    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onEnd);
    };
  }, [onRefresh]);

  const ready = !busy && pull >= TRIGGER;

  return (
    <div
      className={`${styles.strip} ${settling ? styles.settling : ""}`}
      style={{ height: pull }}
      aria-hidden={pull === 0}
      data-testid="pull-to-refresh"
      data-state={busy ? "busy" : ready ? "ready" : "idle"}
    >
      <span
        className={`${styles.badge} ${ready ? styles.ready : ""} ${busy ? styles.busy : ""}`}
        style={{ opacity: Math.min(1, pull / TRIGGER) }}
      >
        <Icon name={busy ? "spinner" : "chevron-down"} size={18} />
      </span>
    </div>
  );
}
