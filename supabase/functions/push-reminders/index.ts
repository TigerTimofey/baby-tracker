import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

interface Subscription {
  endpoint: string;
  family_id: string | null;
  p256dh: string;
  auth: string;
  timezone: string | null;
}

interface Child {
  id: string;
  family_id: string;
  name: string;
  birth_date: string;
  bedtime: string | null;
  bedtime_warn_minutes: number | null;
  notify_bedtime: boolean;
  notify_wake_window: boolean;
}

interface Sleep {
  child_id: string;
  start_at: string;
  end_at: string | null;
}

interface Reminder {
  kind: string;
  key: string;
  title: string;
  body: string;
}

const BANDS: Array<{ upToMonths: number; wakeMax: number }> = [
  { upToMonths: 1, wakeMax: 60 },
  { upToMonths: 2, wakeMax: 90 },
  { upToMonths: 3, wakeMax: 105 },
  { upToMonths: 4, wakeMax: 120 },
  { upToMonths: 6, wakeMax: 150 },
  { upToMonths: 9, wakeMax: 210 },
  { upToMonths: 12, wakeMax: 240 },
  { upToMonths: 18, wakeMax: 330 },
  { upToMonths: 24, wakeMax: 360 },
  { upToMonths: 36, wakeMax: 420 },
  { upToMonths: 60, wakeMax: 720 },
  { upToMonths: 9999, wakeMax: 840 },
];

function wakeMaxMinutes(months: number): number {
  return (BANDS.find((band) => months <= band.upToMonths) ?? BANDS.at(-1)!)
    .wakeMax;
}

function monthsSince(birthDate: string, now: Date): number {
  const birth = new Date(`${birthDate}T00:00:00Z`);
  const months =
    (now.getUTCFullYear() - birth.getUTCFullYear()) * 12 +
    (now.getUTCMonth() - birth.getUTCMonth());
  return Math.max(0, now.getUTCDate() < birth.getUTCDate() ? months - 1 : months);
}

interface LocalTime {
  date: string;
  minutes: number;
}

function localTime(now: Date, timeZone: string): LocalTime {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const pick = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "00";

  return {
    date: `${pick("year")}-${pick("month")}-${pick("day")}`,
    minutes: Number(pick("hour")) * 60 + Number(pick("minute")),
  };
}

function parseTimeOfDay(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  return h > 23 || m > 59 ? null : h * 60 + m;
}

function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / 60_000);
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} мин`;
  if (rest === 0) return `${hours} ч`;
  return `${hours} ч ${rest} мин`;
}

function remindersFor(
  child: Child,
  sleeps: Sleep[],
  now: Date,
  timeZone: string,
): Reminder[] {
  if (sleeps.some((sleep) => sleep.end_at === null)) return [];

  const local = localTime(now, timeZone);
  const out: Reminder[] = [];

  const bedtimeMinutes = child.bedtime ? parseTimeOfDay(child.bedtime) : null;
  const warn = child.bedtime_warn_minutes ?? 30;

  if (bedtimeMinutes !== null && child.notify_bedtime !== false) {
    const until = bedtimeMinutes - local.minutes;
    if (until > 0 && until <= warn) {
      out.push({
        kind: "bedtime-warn",
        key: local.date,
        title: "Скоро сон",
        body: `${child.name}: до отхода ко сну ${until} мин`,
      });
    }
    if (until <= 0 && until > -60) {
      out.push({
        kind: "bedtime",
        key: local.date,
        title: "Пора укладываться",
        body: `${child.name}: время сна — ${child.bedtime}`,
      });
    }
  }

  const lastWake = sleeps
    .map((sleep) => (sleep.end_at ? Date.parse(sleep.end_at) : 0))
    .reduce((max, value) => Math.max(max, value), 0);

  if (lastWake > 0 && child.notify_wake_window !== false) {
    const awake = now.getTime() - lastWake;
    const limit = wakeMaxMinutes(monthsSince(child.birth_date, now)) * 60_000;
    if (awake > limit) {
      out.push({
        kind: "wake-window",
        key: String(lastWake),
        title: "Пора укладывать",
        body: `${child.name} бодрствует ${formatDuration(awake)}`,
      });
    }
  }

  return out;
}

Deno.serve(async (request) => {
  const secret = Deno.env.get("CRON_SECRET");
  if (secret && request.headers.get("x-cron-secret") !== secret) {
    return new Response("forbidden", { status: 403 });
  }

  const publicKey = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
  const privateKey = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
  const subject = Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@example.com";

  if (!publicKey || !privateKey) {
    return Response.json({ error: "VAPID keys are not set" }, { status: 500 });
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const { data: subscriptions } = await supabase
    .from("push_subscriptions")
    .select("endpoint, family_id, p256dh, auth, timezone");

  const byFamily = new Map<string, Subscription[]>();
  for (const item of (subscriptions ?? []) as Subscription[]) {
    if (!item.family_id) continue;
    const list = byFamily.get(item.family_id) ?? [];
    list.push(item);
    byFamily.set(item.family_id, list);
  }

  if (byFamily.size === 0) return Response.json({ sent: 0, families: 0 });

  const { data: children } = await supabase
    .from("children")
    .select(
      "id, family_id, name, birth_date, bedtime, bedtime_warn_minutes, notify_bedtime, notify_wake_window",
    )
    .in("family_id", [...byFamily.keys()])
    .eq("deleted", false);

  const since = new Date(Date.now() - 36 * 3600_000).toISOString();
  const { data: sleeps } = await supabase
    .from("sleep_sessions")
    .select("child_id, start_at, end_at")
    .eq("deleted", false)
    .gte("start_at", since);

  const now = new Date();
  let sent = 0;
  const failures: string[] = [];

  for (const child of (children ?? []) as Child[]) {
    const family = byFamily.get(child.family_id);
    if (!family) continue;

    const timeZone = family.find((item) => item.timezone)?.timezone ?? "UTC";
    const childSleeps = ((sleeps ?? []) as Sleep[]).filter(
      (sleep) => sleep.child_id === child.id,
    );

    for (const reminder of remindersFor(child, childSleeps, now, timeZone)) {
      const claim = await supabase
        .from("push_log")
        .insert({ child_id: child.id, kind: reminder.kind, key: reminder.key });
      if (claim.error) continue;

      for (const item of family) {
        try {
          await webpush.sendNotification(
            {
              endpoint: item.endpoint,
              keys: { p256dh: item.p256dh, auth: item.auth },
            },
            JSON.stringify({
              title: reminder.title,
              body: reminder.body,
              tag: reminder.kind,
            }),
          );
          sent += 1;
        } catch (error) {
          const status = (error as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) {
            await supabase
              .from("push_subscriptions")
              .delete()
              .eq("endpoint", item.endpoint);
          } else {
            failures.push(`${item.endpoint.slice(-12)}: ${String(status)}`);
          }
        }
      }
    }
  }

  return Response.json({ sent, families: byFamily.size, failures });
});
