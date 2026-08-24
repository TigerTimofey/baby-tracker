export type NotifyPermission = NotificationPermission | "unsupported";

export function notificationsSupported(): boolean {
  return typeof Notification !== "undefined" && "serviceWorker" in navigator;
}

export function notificationPermission(): NotifyPermission {
  if (!notificationsSupported()) return "unsupported";
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<NotifyPermission> {
  if (!notificationsSupported()) return "unsupported";
  if (Notification.permission !== "default") return Notification.permission;
  return await Notification.requestPermission();
}

export async function showNotification(
  tag: string,
  title: string,
  body: string,
): Promise<boolean> {
  if (notificationPermission() !== "granted") return false;

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (registration) {
      await registration.showNotification(title, {
        body,
        tag,
        icon: "./icon-192.png",
        badge: "./icon-192.png",
        lang: "ru",
      });
      return true;
    }
    new Notification(title, { body, tag, icon: "./icon-192.png", lang: "ru" });
    return true;
  } catch {
    return false;
  }
}

const FIRED_KEY = "malysh.notified";
const KEEP_MS = 3 * 24 * 3600_000;

function readFired(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(FIRED_KEY) ?? "{}") as Record<
      string,
      number
    >;
  } catch {
    return {};
  }
}

export function alreadyNotified(key: string): boolean {
  return key in readFired();
}

export function markNotified(key: string): void {
  const now = Date.now();
  const fired = readFired();
  fired[key] = now;

  for (const [existing, at] of Object.entries(fired)) {
    if (now - at > KEEP_MS) delete fired[existing];
  }

  try {
    localStorage.setItem(FIRED_KEY, JSON.stringify(fired));
  } catch {
    void 0;
  }
}
