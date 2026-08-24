import { useSyncExternalStore } from "react";
import { useNavigate } from "react-router-dom";
import { getSyncStatus, subscribeSync } from "../data/sync";
import { Icon } from "./ui/Icon";
import styles from "./SyncBadge.module.css";

export function SyncBadge() {
  const status = useSyncExternalStore(
    subscribeSync,
    getSyncStatus,
    getSyncStatus,
  );
  const navigate = useNavigate();

  if (status.state === "idle" && status.pending === 0) return null;
  if (status.state === "disabled" || status.state === "checking") return null;

  const view = (() => {
    switch (status.state) {
      case "syncing":
        return { icon: "cloud", tone: "", text: "Обмен", spin: true };
      case "offline":
        return { icon: "cloud-off", tone: styles.warn, text: "Офлайн" };
      case "signed_out":
        return { icon: "cloud-off", tone: "", text: "Локально" };
      case "error":
        return { icon: "cloud-off", tone: styles.bad, text: "Ошибка" };
      default:
        return {
          icon: "cloud",
          tone: styles.warn,
          text: `${status.pending}`,
        };
    }
  })();

  return (
    <button
      type="button"
      className={[styles.badge, view.tone].filter(Boolean).join(" ")}
      onClick={() => navigate("/settings")}
      title={status.error ?? undefined}
    >
      <Icon
        name={view.icon as "cloud" | "cloud-off"}
        size={15}
        className={view.spin ? styles.spinning : undefined}
      />
      {view.text}
    </button>
  );
}
