/// <reference lib="webworker" />
import { clientsClaim } from "workbox-core";
import { cleanupOutdatedCaches, precacheAndRoute } from "workbox-precaching";

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>;
};

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY?.trim() ?? "";

function urlBase64ToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const padded = base64.padEnd(
    base64.length + ((4 - (base64.length % 4)) % 4),
    "=",
  );
  const raw = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  const buffer = new ArrayBuffer(raw.length);
  const bytes = new Uint8Array(buffer);
  for (let index = 0; index < raw.length; index += 1) {
    bytes[index] = raw.charCodeAt(index);
  }
  return bytes;
}

interface PushPayload {
  title?: string;
  body?: string;
  tag?: string;
  url?: string;
}

/** Сообщение странице: подписка сменилась, её надо сохранить заново. */
const PUSH_CHANGED = "push-subscription-changed";

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

self.skipWaiting();
clientsClaim();

self.addEventListener("push", (event) => {
  let payload: PushPayload = {};
  try {
    payload = (event.data?.json() ?? {}) as PushPayload;
  } catch {
    payload = { body: event.data?.text() ?? "" };
  }

  const title = payload.title ?? "Sebason";
  const options: NotificationOptions = {
    body: payload.body ?? "",
    tag: payload.tag ?? "sebason",
    icon: "./icon-192.png",
    badge: "./icon-192.png",
    lang: "ru",
    data: { url: payload.url ?? "./" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

/**
 * Браузер время от времени меняет адрес подписки сам, без спроса — и всегда
 * меняет после переустановки приложения. Строка на сервере после этого мертва:
 * отправка получает 410, строка удаляется, а новую записать некому, и
 * напоминания прекращаются совсем беззвучно.
 *
 * Здесь подписываемся заново и будим страницу, чтобы она сохранила новый
 * адрес. Сам воркер этого сделать не может: ключей аккаунта у него нет.
 */
self.addEventListener("pushsubscriptionchange", ((event: ExtendableEvent) => {
  event.waitUntil(
    (async () => {
      if (VAPID_PUBLIC_KEY) {
        try {
          await self.registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToBytes(VAPID_PUBLIC_KEY),
          });
        } catch {
          // Не вышло — страница попробует сама при следующем открытии.
        }
      }

      const clients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const client of clients) {
        client.postMessage({ type: PUSH_CHANGED });
      }
    })(),
  );
}) as EventListener);

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const target = (event.notification.data as { url?: string })?.url ?? "./";

  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const client of all) {
        if ("focus" in client) return client.focus();
      }
      return self.clients.openWindow(target);
    })(),
  );
});
