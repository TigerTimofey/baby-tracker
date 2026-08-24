import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { dismissToast, getToast, subscribeToast } from "./toast";
import styles from "./Toaster.module.css";

export function Toaster() {
  const toast = useSyncExternalStore(subscribeToast, getToast, getToast);
  if (!toast) return null;

  return createPortal(
    <div className={styles.wrap}>
      <div className={styles.toast} key={toast.id} role="status">
        <span className={styles.text}>{toast.text}</span>
        {toast.action && (
          <button
            type="button"
            className={styles.action}
            onClick={() => {
              const run = toast.action?.run;
              dismissToast();
              void run?.();
            }}
          >
            {toast.action.label}
          </button>
        )}
      </div>
      <div className={styles.bar}>
        <div
          className={styles.barFill}
          style={{ animationDuration: `${toast.durationMs}ms` }}
        />
      </div>
    </div>,
    document.body,
  );
}
