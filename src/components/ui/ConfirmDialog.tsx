import { t } from "../../lib/i18n";
import type { ReactNode } from "react";
import { Button } from "./Button";
import { FormActions } from "./Form";
import { Sheet } from "./Sheet";
import styles from "./ConfirmDialog.module.css";

interface ConfirmDialogProps {
  open: boolean;
  title: ReactNode;
  text?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

/**
 * Спросить перед необратимым на вид действием. Своя шторка, а не браузерный
 * confirm: тот выглядит чужим в приложении на телефоне и не закрывается
 * свайпом, как всё остальное здесь.
 */
export function ConfirmDialog({
  open,
  title,
  text,
  confirmLabel = t("Удалить"),
  cancelLabel = t("Отмена"),
  danger = true,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      {text && <p className={styles.text}>{text}</p>}

      <FormActions>
        <Button variant="secondary" onClick={onClose}>
          {cancelLabel}
        </Button>
        <Button variant={danger ? "danger" : "primary"} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </FormActions>
    </Sheet>
  );
}
