import { useState } from "react";
import { Button } from "../../components/ui/Button";
import { Field, TextInput } from "../../components/ui/Form";
import { joinFamily } from "../../data/sync";
import styles from "./JoinFamilyForm.module.css";

interface JoinFamilyFormProps {
  onJoined?: () => void;
  autoFocus?: boolean;
}

export function JoinFamilyForm({ onJoined, autoFocus }: JoinFamilyFormProps) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await joinFamily(code);
      setCode("");
      setMessage("Готово — данные семьи загружаются");
      onJoined?.();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.wrap}>
      <Field
        label="Код приглашения"
        hint="Шесть символов из настроек второго родителя"
      >
        {(id) => (
          <TextInput
            id={id}
            value={code}
            autoFocus={autoFocus}
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            placeholder="A1B2C3"
            onChange={(event) => setCode(event.target.value.toUpperCase())}
          />
        )}
      </Field>

      <Button
        variant="primary"
        block
        disabled={busy || code.trim().length < 4}
        onClick={() => void submit()}
      >
        Присоединиться
      </Button>

      {message && <p className={styles.message}>{message}</p>}
      {error && <p className={`${styles.message} ${styles.error}`}>{error}</p>}
    </div>
  );
}
