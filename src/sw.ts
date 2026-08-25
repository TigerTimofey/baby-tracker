/// <reference lib="webworker" />
import { clientsClaim } from "workbox-core";
import { cleanupOutdatedCaches, precacheAndRoute } from "workbox-precaching";

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>;
};

interface PushPayload {
  title?: string;
  body?: string;
  tag?: string;
  url?: string;
}

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
