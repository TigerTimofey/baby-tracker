import { t } from "../../lib/i18n";
import { LangSwitch } from "../../components/ui/LangSwitch";
import { useEffect, useState } from "react";
import { Button } from "../../components/ui/Button";
import { Field, TextInput } from "../../components/ui/Form";
import { GoogleMark } from "../../components/ui/GoogleMark";
import { Icon } from "../../components/ui/Icon";
import { getPendingInvite } from "../../data/invite";
// Вход без регистрации отключён — см. закомментированную кнопку ниже.
// import { updateSettings } from "../../data/settings";
import {
  fetchEnabledProviders,
  requestCode,
  signInWithGoogle,
  verifyCode,
} from "../../data/sync";
import styles from "./AuthGate.module.css";

interface AuthGateProps {
  configured: boolean;
}

type Mode = "choices" | "email" | "code";

const ERROR_PARAMS = ["error", "error_code", "error_description"];

function readErrorFromUrl(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get("error_description") ?? params.get("error");
}

export function AuthGate({ configured }: AuthGateProps) {
  const [mode, setMode] = useState<Mode>("choices");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(readErrorFromUrl);
  const [googleReady, setGoogleReady] = useState<boolean | null>(null);
  const invited = Boolean(getPendingInvite());

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (!ERROR_PARAMS.some((key) => params.has(key))) return;

    for (const key of ERROR_PARAMS) params.delete(key);
    const query = params.toString();
    window.history.replaceState(
      {},
      "",
      window.location.pathname + (query ? `?${query}` : "") + window.location.hash,
    );
  }, []);

  useEffect(() => {
    if (!configured) return;
    let cancelled = false;
    void fetchEnabledProviders().then((providers) => {
      if (!cancelled) setGoogleReady(providers ? providers.google : true);
    });
    return () => {
      cancelled = true;
    };
  }, [configured]);

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

  return (
    <div className={styles.screen}>
      <LangSwitch className={styles.lang} />

      <span className={styles.mark}>
        <Icon name="moon" size={38} />
      </span>

      <h1 className={styles.title}>Sebason</h1>

      {!configured ? (
        <>
          <p className={styles.text}>
            {t("Чтобы войти, нужны ключи вашего проекта Supabase.")}
          </p>
          <div className={styles.setup}>
            {t("Создайте файл")} <code>.env</code> {t("в корне проекта:")}
            <br />
            <br />
            <code>VITE_SUPABASE_URL=…</code>
            <br />
            <code>VITE_SUPABASE_ANON_KEY=…</code>
            <br />
            <br />
            {t("Значения — в Supabase → Project Settings → API. После этого\n            перезапустите")} <code>npm run dev</code>{t(": переменные читаются только\n            при старте.")}
          </div>
        </>
      ) : (
        <>
          <p className={styles.text}>
            {invited
              ? t("Вас пригласили в семью. Войдите — и записи малыша появятся здесь.")
              : t("Войдите, чтобы записи хранились в вашем аккаунте и были доступны обоим родителям.")}
          </p>

          <div className={styles.panel}>
            {mode === "choices" && (
              <>
                <button
                  type="button"
                  className={styles.google}
                  disabled={busy || googleReady === false}
                  onClick={() => run(signInWithGoogle)}
                >
                  <GoogleMark />
                  {t("Войти через Google")}
                </button>

                {googleReady === false && (
                  <p className={styles.message}>
                    {t("Провайдер Google ещё не включён в вашем проекте Supabase:\n                    Authentication → Providers → Google. Пока можно войти по\n                    коду из почты.")}
                  </p>
                )}

                <div className={styles.divider}>{t("или")}</div>

                <button
                  type="button"
                  className={styles.link}
                  onClick={() => setMode("email")}
                >
                  {t("Войти по коду из почты")}
                </button>
              </>
            )}

            {mode === "email" && (
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
                      autoFocus
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
                      setMode("code");
                    }, t("Письмо отправлено — проверьте почту"))
                  }
                >
                  {t("Получить код")}
                </Button>
                <div className={styles.divider}>{t("или")}</div>
                <button
                  type="button"
                  className={styles.link}
                  onClick={() => setMode("choices")}
                >
                  {t("Вернуться к входу через Google")}
                </button>
              </>
            )}

            {mode === "code" && (
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
                      autoFocus
                    />
                  )}
                </Field>
                <Button
                  variant="primary"
                  block
                  disabled={busy || code.trim().length < 6}
                  onClick={() => run(() => verifyCode(email, code))}
                >
                  {t("Войти")}
                </Button>
                <div className={styles.divider}>{t("или")}</div>
                <button
                  type="button"
                  className={styles.link}
                  onClick={() => {
                    setMode("email");
                    setCode("");
                  }}
                >
                  {t("Указать другую почту")}
                </button>
              </>
            )}

            {message && <p className={styles.message}>{message}</p>}
            {error && (
              <p className={`${styles.message} ${styles.error}`}>{error}</p>
            )}
          </div>
        </>
      )}

      {/* Вход без регистрации отключён: пользоваться апкой можно только после входа.
      <button
        type="button"
        className={styles.skip}
        onClick={() => updateSettings({ localOnly: true })}
      >
        {t("Пока без синхронизации, только на этом устройстве")}
      </button>
      */}
    </div>
  );
}
