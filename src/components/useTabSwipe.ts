import { useEffect } from "react";

const MIN_DISTANCE = 70;
const AXIS_RATIO = 1.4;
const START_SLOP = 10;
const BLOCKED =
  "input, textarea, select, [role='tablist'], [data-noswipe], [role='dialog']";

export function useTabSwipe(onSwipe: (direction: 1 | -1) => void): void {
  useEffect(() => {
    let startX: number | null = null;
    let startY = 0;
    let axis: "none" | "horizontal" | "vertical" = "none";

    const onStart = (event: TouchEvent) => {
      if (event.touches.length !== 1) {
        startX = null;
        return;
      }
      const target = event.target as HTMLElement | null;
      if (target?.closest(BLOCKED) || document.querySelector("[role='dialog']")) {
        startX = null;
        return;
      }
      startX = event.touches[0].clientX;
      startY = event.touches[0].clientY;
      axis = "none";
    };

    const onMove = (event: TouchEvent) => {
      if (startX === null) return;

      const dx = event.touches[0].clientX - startX;
      const dy = event.touches[0].clientY - startY;

      if (axis === "none") {
        if (Math.abs(dx) < START_SLOP && Math.abs(dy) < START_SLOP) return;
        axis =
          Math.abs(dx) > Math.abs(dy) * AXIS_RATIO ? "horizontal" : "vertical";
      }
      if (axis === "vertical") startX = null;
    };

    const onEnd = (event: TouchEvent) => {
      if (startX === null || axis !== "horizontal") {
        startX = null;
        return;
      }

      const dx = (event.changedTouches[0]?.clientX ?? startX) - startX;
      startX = null;

      if (Math.abs(dx) < MIN_DISTANCE) return;
      onSwipe(dx < 0 ? 1 : -1);
    };

    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onEnd, { passive: true });
    window.addEventListener("touchcancel", onEnd, { passive: true });

    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onEnd);
    };
  }, [onSwipe]);
}
