import { getSettings } from "../data/settings";
import { lang } from "./i18n";
import { supabase } from "./supabase";

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY?.trim() ?? "";

export function pushConfigured(): boolean {
  return VAPID_PUBLIC_KEY.length > 0;
}

export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window
  );
}

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

function keyToBase64(key: ArrayBuffer | null): string {
  if (!key) return "";
  const bytes = new Uint8Array(key);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export interface PushResult {
  ok: boolean;
  reason?: "unsupported" | "not-configured" | "no-account" | "denied" | "failed";
}

/** Сообщение от service worker: подписку сменил браузер, надо перезаписать. */
export const PUSH_CHANGED = "push-subscription-changed";

/** Сообщение от service worker: пришло уведомление, экран мог устареть. */
export const PUSH_RECEIVED = "push-received";

async function storeSubscription(
  subscription: PushSubscription,
  userId: string,
  familyId: string | null,
): Promise<PushResult> {
  if (!supabase) return { ok: false, reason: "no-account" };

  const json = subscription.toJSON();
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      endpoint: subscription.endpoint,
      user_id: userId,
      family_id: familyId,
      p256dh: json.keys?.p256dh ?? keyToBase64(subscription.getKey("p256dh")),
      auth: json.keys?.auth ?? keyToBase64(subscription.getKey("auth")),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      // Язык устройства, а не семьи: у родителей он может быть разный.
      locale: lang(),
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: "endpoint" },
  );

  return error ? { ok: false, reason: "failed" } : { ok: true };
}

/**
 * Та ли это подписка, что нужна серверу.
 *
 * Ключ VAPID вшивается в подписку при создании и потом не меняется. Если ключ
 * на сервере сменили, браузер продолжает отдавать старую подписку как ни в чём
 * не бывало — а push-сервис отвечает на неё 403. Сравниваем байты.
 */
function sameKey(subscription: PushSubscription): boolean {
  const raw = subscription.options.applicationServerKey;
  if (!raw) return false;
  const have = new Uint8Array(raw);
  const want = urlBase64ToBytes(VAPID_PUBLIC_KEY);
  return (
    have.length === want.length && have.every((byte, i) => byte === want[i])
  );
}

/**
 * Подписка под нынешний ключ. Старую, если ключ разошёлся, отменяем и удаляем
 * её строку: иначе она осталась бы в базе мёртвым грузом, а сервер продолжал
 * бы стучаться по ней и получать отказ.
 */
async function liveSubscription(
  registration: ServiceWorkerRegistration,
): Promise<PushSubscription> {
  const existing = await registration.pushManager.getSubscription();
  if (existing && sameKey(existing)) return existing;

  if (existing) {
    const dead = existing.endpoint;
    await existing.unsubscribe();
    if (supabase) {
      await supabase.from("push_subscriptions").delete().eq("endpoint", dead);
    }
  }

  return registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToBytes(VAPID_PUBLIC_KEY),
  });
}

async function currentUserId(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

export async function enablePush(familyId: string | null): Promise<PushResult> {
  if (!pushSupported()) return { ok: false, reason: "unsupported" };
  if (!pushConfigured()) return { ok: false, reason: "not-configured" };

  const userId = await currentUserId();
  if (!userId) return { ok: false, reason: "no-account" };

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await liveSubscription(registration);

    return await storeSubscription(subscription, userId, familyId);
  } catch {
    return { ok: false, reason: "failed" };
  }
}

/**
 * Тихо чинит подписку при каждом запуске приложения.
 *
 * Адрес подписки браузер меняет сам, и старая строка на сервере после этого
 * удаляется по 410. Раньше записать новую было некому: `enablePush` звали
 * только из тумблера в настройках, а его больше не трогают. Так уведомления
 * умирали навсегда и молча. Теперь при каждом открытии приложения адрес
 * перезаписывается — заодно обновляется `last_seen_at` и язык.
 *
 * Разрешения не спрашивает: без ответа «да» просто уходит.
 */
export async function refreshPush(familyId: string | null): Promise<PushResult> {
  if (!pushSupported() || !pushConfigured()) return { ok: false };
  if (Notification.permission !== "granted") return { ok: false, reason: "denied" };
  if (!getSettings().notifications) return { ok: false };

  const userId = await currentUserId();
  if (!userId) return { ok: false, reason: "no-account" };

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await liveSubscription(registration);
    return await storeSubscription(subscription, userId, familyId);
  } catch {
    return { ok: false, reason: "failed" };
  }
}

export type PushState =
  | "unsupported"
  | "not-configured"
  | "no-account"
  | "off"
  | "lost"
  | "on";

/**
 * Что на самом деле с подпиской. Проверяем не только браузер, но и строку на
 * сервере: без неё уведомления при закрытом приложении не придут, а по виду
 * тумблера этого никак не понять.
 */
export async function pushStatus(): Promise<PushState> {
  if (!pushSupported()) return "unsupported";
  if (!pushConfigured()) return "not-configured";

  const userId = await currentUserId();
  if (!userId) return "no-account";

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    const subscription = await registration?.pushManager.getSubscription();
    if (!subscription) return "off";
    if (!sameKey(subscription)) return "lost";
    if (!supabase) return "off";

    const { data, error } = await supabase
      .from("push_subscriptions")
      .select("endpoint")
      .eq("endpoint", subscription.endpoint)
      .maybeSingle();

    if (error) return "lost";
    return data ? "on" : "lost";
  } catch {
    return "off";
  }
}

export async function disablePush(): Promise<void> {
  if (!pushSupported()) return;

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return;

    if (supabase) {
      await supabase
        .from("push_subscriptions")
        .delete()
        .eq("endpoint", subscription.endpoint);
    }
    await subscription.unsubscribe();
  } catch {
    void 0;
  }
}
