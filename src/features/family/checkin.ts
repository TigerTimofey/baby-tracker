import { supabase } from "../../lib/supabase";

/**
 * Пинг второму родителю: «всё по плану?» и ответ одним нажатием.
 *
 * Единственная часть приложения, которая живёт только на сервере. Офлайн у
 * такого вопроса смысла нет: он про «прямо сейчас», и если сети нет, спрашивать
 * попросту некого.
 */
export type CheckinAnswer = "ok" | "not_ok";

export interface Checkin {
  id: string;
  from_user: string;
  to_user: string;
  asked_at: string;
  answer: CheckinAnswer | null;
  answered_at: string | null;
}

/** Дольше этого вопрос протух: спрашивали про «сейчас», а сейчас уже другое. */
const FRESH_MS = 6 * 3600_000;

export type AskResult =
  | { ok: true; sent: number; targets: number }
  | { ok: false; reason: "offline" | "failed" };

async function callFunction(
  body: Record<string, string>,
): Promise<AskResult> {
  if (!supabase) return { ok: false, reason: "offline" };

  const { data: session } = await supabase.auth.getSession();
  const token = session.session?.access_token;
  if (!token) return { ok: false, reason: "offline" };

  try {
    const { data, error } = await supabase.functions.invoke("push-checkin", {
      body,
    });
    if (error) return { ok: false, reason: "failed" };
    const answer = data as {
      sent?: number;
      targets?: number;
      failures?: string[];
    } | null;

    // В консоль, а не на экран: родителю код ошибки ничего не скажет, а без
    // него причина недоставки не видна вообще ниоткуда.
    //
    // Отказ на одну подписку — ещё не провал: у человека их бывает несколько,
    // и мёртвые остаются от старых ключей. Пока хоть одна доставлена,
    // уведомление человек увидел, а мёртвые функция тут же удаляет.
    const sent = answer?.sent ?? 0;
    const targets = answer?.targets ?? 0;
    const failures = answer?.failures ?? [];

    if (failures.length && sent > 0) {
      // debug, а не warn: уведомление человек получил, а мёртвые строки
      // функция тут же удалила. Кричать тут не о чем.
      console.debug(
        `push-checkin: доставлено ${sent} из ${targets}, мёртвые подписки удалены —`,
        failures.join(" · "),
      );
    } else if (failures.length) {
      console.warn("push-checkin не доставил:", failures.join(" · "));
    }

    return { ok: true, sent, targets };
  } catch {
    return { ok: false, reason: "failed" };
  }
}

export function askCheckin(toUserId: string): Promise<AskResult> {
  return callFunction({ to: toUserId });
}

export function answerCheckin(
  id: string,
  answer: CheckinAnswer,
): Promise<AskResult> {
  return callFunction({ id, answer });
}

const since = () => new Date(Date.now() - FRESH_MS).toISOString();

/** Свежий вопрос ко мне, на который я ещё не ответил. */
export async function incomingCheckin(
  myUserId: string,
): Promise<Checkin | null> {
  if (!supabase) return null;
  const { data } = await supabase
    .from("checkins")
    .select("id, from_user, to_user, asked_at, answer, answered_at")
    .eq("to_user", myUserId)
    .is("answer", null)
    .gte("asked_at", since())
    .order("asked_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (data as Checkin) ?? null;
}

/** Последний мой вопрос: ждёт ответа или уже отвечен. */
export async function myLastCheckin(
  myUserId: string,
): Promise<Checkin | null> {
  if (!supabase) return null;
  const { data } = await supabase
    .from("checkins")
    .select("id, from_user, to_user, asked_at, answer, answered_at")
    .eq("from_user", myUserId)
    .gte("asked_at", since())
    .order("asked_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (data as Checkin) ?? null;
}
