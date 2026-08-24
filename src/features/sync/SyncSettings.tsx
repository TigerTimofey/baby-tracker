import { useState, useSyncExternalStore } from "react";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Field, TextInput } from "../../components/ui/Form";
import { GoogleMark } from "../../components/ui/GoogleMark";
import { Icon } from "../../components/ui/Icon";
import {
  getSyncStatus,
  requestCode,
  signInWithGoogle,
  signOutSync,
  subscribeSync,
  syncNow,
  verifyCode,
} from "../../data/sync";
import { inviteLink } from "../../data/invite";
import { formatTime, plural } from "../../lib/time";
import { JoinFamilyForm } from "./JoinFamilyForm";
import styles from "./SyncSettings.module.css";

type Step = "email" | "code";

export function SyncSettings() {
  const status = useSyncExternalStore(
    subscribeSync,
    getSyncStatus,
    getSyncStatus,
  );

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<void>, done?: string) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await action();
      if (done) setMessage(done);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  if (status.state === "disabled") {
    return (
      <Card title="Синхронизация">
        <p className={styles.setup}>
          Сейчас все записи хранятся только на этом устройстве. Чтобы данные
          были и на втором телефоне:
          <br />
          <br />
          1. Создайте бесплатный проект на <code>supabase.com</code>
          <br />
          2. Выполните <code>supabase/schema.sql</code> в SQL Editor
          <br />
          3. Скопируйте <code>.env.example</code> в <code>.env.local</code> и
          подставьте URL и anon key
          <br />
          4. Перезапустите <code>npm run dev</code>
          <br />
          <br />
          Подробности — в <code>README.md</code>.
        </p>
      </Card>
    );
  }

  if (status.state === "checking") return null;

  if (status.state === "signed_out") {
    return (
      <Card title="Синхронизация">
        <div className={styles.state}>
          <span className={styles.dot} />
          <div>
            <div className={styles.stateText}>Только на этом устройстве</div>
            <div className={styles.stateSub}>
              Войдите, чтобы данные были у обоих родителей
            </div>
          </div>
        </div>

        <button
          type="button"
          className={styles.google}
          disabled={busy}
          onClick={() => run(signInWithGoogle)}
        >
          <GoogleMark />
          Войти через Google
        </button>

        <div className={styles.divider}>или по коду из почты</div>

        {step === "email" ? (
          <>
            <Field label="Почта" hint="Пришлём код для входа">
              {(id) => (
                <TextInput
                  id={id}
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              )}
            </Field>
            <Button
              variant="primary"
              block
              disabled={busy || !email.includes("@")}
              onClick={() =>
                run(async () => {
                  await requestCode(email);
                  setStep("code");
                }, "Письмо отправлено — проверьте почту")
              }
            >
              Получить код
            </Button>
          </>
        ) : (
          <>
            <Field label="Код из письма" hint={`Отправлен на ${email}`}>
              {(id) => (
                <TextInput
                  id={id}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="123456"
                />
              )}
            </Field>
            <div className={styles.buttons}>
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => {
                  setStep("email");
                  setCode("");
                }}
              >
                Назад
              </Button>
              <Button
                variant="primary"
                disabled={busy || code.trim().length < 6}
                onClick={() =>
                  run(async () => {
                    await verifyCode(email, code);
                  })
                }
              >
                Войти
              </Button>
            </div>
          </>
        )}

        {message && <p className={styles.message}>{message}</p>}
        {error && (
          <p className={`${styles.message} ${styles.messageError}`}>{error}</p>
        )}
      </Card>
    );
  }

  const dot =
    status.state === "error"
      ? styles.dotBad
      : status.state === "offline"
        ? styles.dotWarn
        : status.pending > 0
          ? styles.dotWarn
          : styles.dotOk;

  const stateText =
    status.state === "error"
      ? "Ошибка синхронизации"
      : status.state === "offline"
        ? "Нет сети — данные сохраняются локально"
        : status.state === "syncing"
          ? "Синхронизация…"
          : status.pending > 0
            ? `${status.pending} записей ждут отправки`
            : "Всё синхронизировано";

  return (
    <Card title="Синхронизация">
      <div className={styles.state}>
        <span className={`${styles.dot} ${dot}`} />
        <div>
          <div className={styles.stateText}>{stateText}</div>
          <div className={styles.stateSub}>
            {status.email}
            {status.lastSyncAt &&
              ` · последний обмен в ${formatTime(status.lastSyncAt)}`}
          </div>
        </div>
      </div>

      {status.inviteCode && (
        <div className={styles.code}>
          <div>
            <div className={styles.codeLabel}>Код приглашения</div>
            <div className={`${styles.codeValue} tnum`}>
              {status.inviteCode}
            </div>
          </div>
          <Button
            size="sm"
            variant="primary"
            onClick={() =>
              run(async () => {
                const link = inviteLink(status.inviteCode ?? "");
                if (navigator.share) {
                  await navigator.share({
                    title: "Sebason",
                    text: "Приглашение в семью",
                    url: link,
                  });
                  return;
                }
                await navigator.clipboard.writeText(link);
              }, "Ссылка готова — отправьте её второму родителю")
            }
          >
            Поделиться
          </Button>
        </div>
      )}

      <JoinFamilyForm />

      <div className={styles.buttons}>
        <Button
          variant="soft"
          disabled={busy || status.state === "syncing"}
          onClick={() => run(() => syncNow())}
        >
          <Icon name="cloud" size={16} />
          Синхронизировать
        </Button>
      </div>

      <div className={styles.signOut}>
        <Button
          variant="danger"
          block
          disabled={busy}
          onClick={() => {
            const pending =
              status.pending > 0
                ? `\n\n${status.pending} ${plural(status.pending, ["запись ещё не отправлена", "записи ещё не отправлены", "записей ещё не отправлены"])} на сервер. Они останутся на устройстве и уедут при следующем входе.`
                : "";
            const confirmed = window.confirm(
              `Выйти из аккаунта ${status.email ?? ""}?` +
                "\n\nЗаписи останутся на этом устройстве, но перестанут синхронизироваться со вторым телефоном." +
                pending,
            );
            if (!confirmed) return;
            void run(async () => {
              await signOutSync();
              setStep("email");
            });
          }}
        >
          Выйти из аккаунта
        </Button>
      </div>

      {message && <p className={styles.message}>{message}</p>}
      {(error ?? status.error) && (
        <p className={`${styles.message} ${styles.messageError}`}>
          {error ?? status.error}
        </p>
      )}
    </Card>
  );
}
