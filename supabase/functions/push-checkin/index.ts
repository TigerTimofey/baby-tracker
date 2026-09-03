import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

/**
 * Пинг между родителями: «всё по плану?» и ответ на него.
 *
 * Отдельная функция от push-reminders: та ходит по расписанию и никого не
 * спрашивает, эта срабатывает по нажатию и должна знать, кто нажал.
 *
 * Запись в `checkins` делает сама функция, а не приложение: тогда и запись,
 * и отправка происходят за один заход, и нельзя отправить уведомление о
 * чужом пинге.
 */
type Lang = "en" | "et" | "ru";
type Answer = "ok" | "not_ok";

interface AskBody {
  to: string;
}

interface AnswerBody {
  id: string;
  answer: Answer;
}

const ASK: Record<Lang, [string, string]> = {
  ru: ["Всё по плану?", "{name} спрашивает, как дела"],
  en: ["Everything going to plan?", "{name} is asking how it’s going"],
  et: ["Kas kõik läheb plaanipäraselt?", "{name} küsib, kuidas läheb"],
};

const REPLY: Record<Lang, Record<Answer, [string, string]>> = {
  ru: {
    ok: ["Всё по плану", "{name} ответил: всё хорошо"],
    not_ok: ["Не по плану", "{name} ответил: что-то не так"],
  },
  en: {
    ok: ["All to plan", "{name} answered: all good"],
    not_ok: ["Not to plan", "{name} answered: something’s off"],
  },
  et: {
    ok: ["Kõik plaanipäraselt", "{name} vastas: kõik on hästi"],
    not_ok: ["Pole plaanipäraselt", "{name} vastas: midagi on viltu"],
  },
};

function langOf(locale: string | null): Lang {
  return locale === "ru" || locale === "et" ? locale : "en";
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "access-control-allow-origin": "*",
        // Отражаем то, что браузер спросил. Перечислять руками нельзя:
        // supabase-js шлёт свои заголовки (x-client-info, apikey), и любой
        // забытый обрушивает запрос ещё до функции.
        "access-control-allow-headers":
          request.headers.get("access-control-request-headers") ??
          "authorization, content-type, x-client-info, apikey",
        "access-control-allow-methods": "POST, OPTIONS",
        "access-control-max-age": "86400",
      },
    });
  }

  const cors = { "access-control-allow-origin": "*" };
  const json = (body: unknown, status = 200) =>
    Response.json(body, { status, headers: cors });

  const authorization = request.headers.get("Authorization") ?? "";
  if (!authorization) return json({ error: "no token" }, 401);

  const publicKey = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
  const privateKey = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
  if (!publicKey || !privateKey) {
    return json({ error: "VAPID keys are not set" }, 500);
  }
  webpush.setVapidDetails(
    Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@example.com",
    publicKey,
    privateKey,
  );

  const url = Deno.env.get("SUPABASE_URL")!;

  // Клиент от имени нажавшего: по нему проверяем, кто он и в какой семье.
  const caller = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const { data: userData } = await caller.auth.getUser();
  const me = userData.user;
  if (!me) return json({ error: "not signed in" }, 401);

  // Служебный клиент: подписки и имена лежат за политиками доступа.
  const admin = createClient(
    url,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const body = (await request.json().catch(() => ({}))) as Partial<
    AskBody & AnswerBody
  >;

  const { data: membership } = await admin
    .from("family_members")
    .select("family_id, display_name")
    .eq("user_id", me.id)
    .limit(1)
    .maybeSingle();

  if (!membership) return json({ error: "no family" }, 400);
  const myName = membership.display_name ?? "";

  let target: string;
  let kind: "checkin" | "checkin-answer";

  if (body.answer && body.id) {
    const { data: row } = await admin
      .from("checkins")
      .select("id, from_user, to_user, answer")
      .eq("id", body.id)
      .maybeSingle();

    if (!row) return json({ error: "not found" }, 404);
    if (row.to_user !== me.id) return json({ error: "not yours" }, 403);
    if (row.answer) return json({ error: "already answered" }, 409);

    await admin
      .from("checkins")
      .update({ answer: body.answer, answered_at: new Date().toISOString() })
      .eq("id", row.id);

    target = row.from_user;
    kind = "checkin-answer";
  } else if (body.to) {
    if (body.to === me.id) return json({ error: "self" }, 400);

    // Спрашивать можно только своих: без этой проверки по чужому id можно
    // было бы прислать уведомление кому угодно.
    const { data: mate } = await admin
      .from("family_members")
      .select("user_id")
      .eq("family_id", membership.family_id)
      .eq("user_id", body.to)
      .maybeSingle();

    if (!mate) return json({ error: "not in family" }, 403);

    const { data: row, error } = await admin
      .from("checkins")
      .insert({
        family_id: membership.family_id,
        from_user: me.id,
        to_user: body.to,
      })
      .select("id")
      .single();

    if (error || !row) return json({ error: "insert failed" }, 500);

    target = body.to;
    kind = "checkin";
  } else {
    return json({ error: "bad request" }, 400);
  }

  const { data: subscriptions } = await admin
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth, locale")
    .eq("user_id", target);

  // Текст собираем на каждую подписку отдельно: язык у родителей может
  // отличаться, и уведомление уходит на языке того, кто его получит.
  const FALLBACK: Record<Lang, string> = {
    ru: "второй родитель",
    en: "the other parent",
    et: "teine vanem",
  };

  // Причины отказа возвращаем наружу: без них «не доставилось» — тупик.
  // 403 обычно значит, что подписку создавали под другой ключ VAPID,
  // 410 — что адрес протух, а пустой код — что упала сама отправка.
  const failures: string[] = [];

  let sent = 0;
  for (const item of subscriptions ?? []) {
    const lang = langOf(item.locale);
    const [title, line] =
      kind === "checkin" ? ASK[lang] : REPLY[lang][body.answer as Answer];
    const text = line.replace("{name}", myName || FALLBACK[lang]);

    try {
      await webpush.sendNotification(
        {
          endpoint: item.endpoint,
          keys: { p256dh: item.p256dh, auth: item.auth },
        },
        JSON.stringify({ title, body: text, tag: kind }),
      );
      sent += 1;
    } catch (error) {
      // Тело ответа push-сервиса — единственное место, где отказ назван
      // словами: сам код 400 не отличает кривой ключ от кривого JWT.
      const fail = error as { statusCode?: number; body?: string };
      failures.push(
        `${fail.statusCode ?? "?"}: ${(fail.body ?? String(error)).slice(0, 200)}`,
      );
      // 403 — подписку создавали под другой ключ VAPID: этим ключом её
      // не оживить никогда, и держать строку незачем.
      const status = fail.statusCode;
      if (status === 403 || status === 404 || status === 410) {
        await admin
          .from("push_subscriptions")
          .delete()
          .eq("endpoint", item.endpoint);
      }
    }
  }

  // targets отдаём отдельно: «подписок нет вовсе» и «ни одна не доставилась»
  // выглядят одинаково по sent, а чинятся по-разному.
  return json({ sent, targets: (subscriptions ?? []).length, failures });
});
