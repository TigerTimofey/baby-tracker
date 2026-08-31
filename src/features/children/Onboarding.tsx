import { t } from "../../lib/i18n";
import { useState, useSyncExternalStore } from "react";
import { Button } from "../../components/ui/Button";
import { LangSwitch } from "../../components/ui/LangSwitch";
import { Icon } from "../../components/ui/Icon";
import { getSyncStatus, subscribeSync } from "../../data/sync";
import { JoinFamilySheet } from "../sync/JoinFamilySheet";
import { ChildForm } from "./ChildForm";
import styles from "./Onboarding.module.css";

export function Onboarding() {
  const [formOpen, setFormOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const status = useSyncExternalStore(
    subscribeSync,
    getSyncStatus,
    getSyncStatus,
  );
  const signedIn = Boolean(status.email);

  return (
    <div className={styles.screen}>
      <LangSwitch className={styles.lang} />

      <span className={styles.mark}>
        <Icon name="moon" size={38} />
      </span>

      <h1 className={styles.title}>Sebason</h1>
      <p className={styles.text}>
        {t("Дневник сна, роста и первых достижений. Записи хранятся на устройстве и\n        работают без интернета.")}
      </p>

      <div className={styles.actions}>
        <Button variant="primary" size="lg" block onClick={() => setFormOpen(true)}>
          <Icon name="plus" size={19} />
          {t("Добавить малыша")}
        </Button>
      </div>

      <p className={styles.note}>
        {t("Понадобятся только имя и дата рождения — остальное можно заполнить\n        позже.")}
      </p>

      {signedIn && (
        <>
          <div className={styles.divider}>{t("или")}</div>
          <button
            type="button"
            className={styles.link}
            onClick={() => setJoinOpen(true)}
          >
            {t("Присоединиться к семье по коду")}
          </button>
          <p className={styles.note}>
            {t("Если малыша уже завёл второй родитель — не создавайте его заново.")}
          </p>
        </>
      )}

      {formOpen && (
        <ChildForm open={formOpen} onClose={() => setFormOpen(false)} />
      )}
      {joinOpen && (
        <JoinFamilySheet open={joinOpen} onClose={() => setJoinOpen(false)} />
      )}
    </div>
  );
}
