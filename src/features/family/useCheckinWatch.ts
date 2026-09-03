import { useEffect } from "react";
import { PUSH_RECEIVED } from "../../lib/push";

/**
 * Когда перечитывать вопрос и ответ.
 *
 * Поводов четыре, и все нужны:
 *
 * - сообщение от service worker — пришёл push, а страница о нём не знает:
 *   показывал его воркер, не она;
 * - возвращение во вкладку и в окно — вопрос мог прийти, пока приложение было
 *   свёрнуто; `visibilitychange` ловит переключение вкладок, `focus` —
 *   переключение между окнами и приложениями, это разные события;
 * - опрос, пока вкладка открыта, — страховка на случай, если сообщение от
 *   воркера не дошло. Без неё вопрос висел бы невидимым, пока человек сам
 *   куда-нибудь не переключится.
 *
 * Пока вкладка скрыта, не опрашиваем: смотреть всё равно некому, а вернувшись,
 * страница перечитает всё сама.
 */
export function useCheckinWatch(look: () => void, everyMs: number | null): void {
  useEffect(() => {
    look();

    const onVisible = () => {
      if (document.visibilityState === "visible") look();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", look);

    const onMessage = (event: MessageEvent) => {
      const data = event.data as { type?: string } | null;
      if (data?.type === PUSH_RECEIVED) look();
    };
    const worker = "serviceWorker" in navigator ? navigator.serviceWorker : null;
    worker?.addEventListener("message", onMessage);

    const timer =
      everyMs === null
        ? null
        : setInterval(() => {
            if (document.visibilityState === "visible") look();
          }, everyMs);

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", look);
      worker?.removeEventListener("message", onMessage);
      if (timer) clearInterval(timer);
    };
  }, [look, everyMs]);
}
