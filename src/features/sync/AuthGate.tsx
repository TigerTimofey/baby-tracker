import { useEffect, useState } from "react";
import { Button } from "../../components/ui/Button";
import { Field, TextInput } from "../../components/ui/Form";
import { GoogleMark } from "../../components/ui/GoogleMark";
import { Icon } from "../../components/ui/Icon";
import { updateSettings } from "../../data/settings";
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
      <span className={styles.mark}>
        <Icon name="moon" size={38} />
      </span>

      <h1 className={styles.title}>Малыш</h1>

      {!configured ? (
        <>
          <p className={styles.text}>
            Чтобы войти, нужны ключи вашего проекта Supabase.
          </p>
          <div className={styles.setup}>
            Создайте файл <code>.env</code> в корне проекта:
            <br />
            <br />
            <code>VITE_SUPABASE_URL=…</code>
            <br />
            <code>VITE_SUPABASE_ANON_KEY=…</code>
            <br />
            <br />
            Значения — в Supabase → Project Settings → API. После этого
            перезапустите <code>npm run dev</code>: переменные читаются только
            при старте.
          </div>
        </>
      ) : (
        <>
          <p className={styles.text}>
            Войдите, чтобы записи хранились в вашем аккаунте и были доступны
            обоим родителям.
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
                  Войти через Google
                </button>

                {googleReady === false && (
                  <p className={styles.message}>
                    Провайдер Google ещё не включён в вашем проекте Supabase:
                    Authentication → Providers → Google. Пока можно войти по
                    коду из почты.
                  </p>
                )}

                <div className={styles.divider}>или</div>

                <button
                  type="button"
                  className={styles.link}
                  onClick={() => setMode("email")}
                >
                  Войти по коду из почты
                </button>
              </>
            )}

            {mode === "email" && (
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
                    }, "Письмо отправлено — проверьте почту")
                  }
                >
                  Получить код
                </Button>
                <div className={styles.divider}>или</div>
                <button
                  type="button"
                  className={styles.link}
                  onClick={() => setMode("choices")}
                >
                  Вернуться к входу через Google
                </button>
              </>
            )}

            {mode === "code" && (
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
                  Войти
                </Button>
                <div className={styles.divider}>или</div>
                <button
                  type="button"
                  className={styles.link}
                  onClick={() => {
                    setMode("email");
                    setCode("");
                  }}
                >
                  Указать другую почту
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

      <button
        type="button"
        className={styles.skip}
        onClick={() => updateSettings({ localOnly: true })}
      >
        Пока без синхронизации, только на этом устройстве
      </button>
    </div>
  );
}
