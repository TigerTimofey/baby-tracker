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

export async function enablePush(familyId: string | null): Promise<PushResult> {
  if (!pushSupported()) return { ok: false, reason: "unsupported" };
  if (!pushConfigured()) return { ok: false, reason: "not-configured" };
  if (!supabase) return { ok: false, reason: "no-account" };

  const { data } = await supabase.auth.getSession();
  const user = data.session?.user;
  if (!user) return { ok: false, reason: "no-account" };

  try {
    const registration = await navigator.serviceWorker.ready;

    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToBytes(VAPID_PUBLIC_KEY),
      });
    }

    const json = subscription.toJSON();
    const { error } = await supabase.from("push_subscriptions").upsert(
      {
        endpoint: subscription.endpoint,
        user_id: user.id,
        family_id: familyId,
        p256dh: json.keys?.p256dh ?? keyToBase64(subscription.getKey("p256dh")),
        auth: json.keys?.auth ?? keyToBase64(subscription.getKey("auth")),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "endpoint" },
    );

    if (error) return { ok: false, reason: "failed" };
    return { ok: true };
  } catch {
    return { ok: false, reason: "failed" };
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
