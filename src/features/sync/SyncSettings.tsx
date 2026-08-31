import { pluralOf, t } from "../../lib/i18n";
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
import {
  formatTime,
} from "../../lib/time";
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
      <Card title={t("Синхронизация")}>
        <p className={styles.setup}>
          {t("Сейчас все записи хранятся только на этом устройстве. Чтобы данные\n          были и на втором телефоне:")}
          <br />
          <br />
          {t("1. Создайте бесплатный проект на")} <code>supabase.com</code>
          <br />
          {t("2. Выполните")} <code>supabase/schema.sql</code> {t("в SQL Editor")}
          <br />
          {t("3. Скопируйте")} <code>.env.example</code> {t("в")} <code>.env.local</code> {t("и\n          подставьте URL и anon key")}
          <br />
          {t("4. Перезапустите")} <code>npm run dev</code>
          <br />
          <br />
          {t("Подробности — в")} <code>README.md</code>.
        </p>
      </Card>
    );
  }

  if (status.state === "checking") return null;

  if (status.state === "signed_out") {
    return (
      <Card title={t("Синхронизация")}>
        <div className={styles.state}>
          <span className={styles.dot} />
          <div>
            <div className={styles.stateText}>{t("Только на этом устройстве")}</div>
            <div className={styles.stateSub}>
              {t("Войдите, чтобы данные были у обоих родителей")}
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
          {t("Войти через Google")}
        </button>

        <div className={styles.divider}>{t("или по коду из почты")}</div>

        {step === "email" ? (
          <>
            <Field label={t("Почта")} hint={t("Пришлём код для входа")}>
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
                }, t("Письмо отправлено — проверьте почту"))
              }
            >
              {t("Получить код")}
            </Button>
          </>
        ) : (
          <>
            <Field label={t("Код из письма")} hint={t("Отправлен на {0}", [email])}>
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
                {t("Назад")}
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
                {t("Войти")}
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
      ? t("Ошибка синхронизации")
      : status.state === "offline"
        ? t("Нет сети — данные сохраняются локально")
        : status.state === "syncing"
          ? t("Синхронизация…")
          : status.pending > 0
            ? t("{0} записей ждут отправки", [status.pending])
            : t("Всё синхронизировано");

  return (
    <Card title={t("Синхронизация")}>
      <div className={styles.state}>
        <span className={`${styles.dot} ${dot}`} />
        <div>
          <div className={styles.stateText}>{stateText}</div>
          <div className={styles.stateSub}>
            {status.email}
            {status.lastSyncAt &&
              t(" · последний обмен в {0}", [formatTime(status.lastSyncAt)])}
          </div>
        </div>
      </div>

      {status.inviteCode && (
        <div className={styles.code}>
          <div>
            <div className={styles.codeLabel}>{t("Код приглашения")}</div>
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
                    text: t("Приглашение в семью"),
                    url: link,
                  });
                  return;
                }
                await navigator.clipboard.writeText(link);
              }, t("Ссылка готова — отправьте её второму родителю"))
            }
          >
            {t("Поделиться")}
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
          {t("Синхронизировать")}
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
                ? t("\n\n{0} {1} на сервер. Они останутся на устройстве и уедут при следующем входе.", [status.pending, pluralOf(status.pending, "запись ещё не отправлена")])
                : "";
            const confirmed = window.confirm(
              t("Выйти из аккаунта {0}?", [status.email ?? ""]) +
                t("\n\nЗаписи останутся на этом устройстве, но перестанут синхронизироваться со вторым телефоном.") +
                pending,
            );
            if (!confirmed) return;
            void run(async () => {
              await signOutSync();
              setStep("email");
            });
          }}
        >
          {t("Выйти из аккаунта")}
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
