import { useState } from "react";
import { Button } from "../../components/ui/Button";
import { Icon } from "../../components/ui/Icon";
import { ChildForm } from "./ChildForm";
import styles from "./Onboarding.module.css";

export function Onboarding() {
  const [formOpen, setFormOpen] = useState(false);

  return (
    <div className={styles.screen}>
      <span className={styles.mark}>
        <Icon name="moon" size={38} />
      </span>

      <h1 className={styles.title}>Sebason</h1>
      <p className={styles.text}>
        Дневник сна, роста и первых достижений. Записи хранятся на устройстве и
        работают без интернета.
      </p>

      <div className={styles.actions}>
        <Button variant="primary" size="lg" block onClick={() => setFormOpen(true)}>
          <Icon name="plus" size={19} />
          Добавить малыша
        </Button>
      </div>

      <p className={styles.note}>
        Понадобятся только имя и дата рождения — остальное можно заполнить
        позже.
      </p>

      {formOpen && (
        <ChildForm open={formOpen} onClose={() => setFormOpen(false)} />
      )}
    </div>
  );
}
