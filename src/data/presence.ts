import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

/**
 * Кто из семьи сейчас в приложении.
 *
 * Через Realtime Presence, а не через отметку в базе: та требовала бы записи
 * каждые пару минут и всё равно показывала бы «был минуту назад» вместо
 * «здесь». Presence живёт в памяти сервера, ничего не пишет и гаснет сам,
 * когда вкладку закрыли или связь пропала.
 *
 * Единственное на всё приложение соединение: канал один на семью, а карточки
 * подписываются на снимок.
 */
let channel: RealtimeChannel | null = null;
let joined = "";
let snapshot: string[] = [];

const listeners = new Set<() => void>();

function update(ids: string[]): void {
  const next = [...ids].sort();
  // Снимок меняем только когда состав изменился: useSyncExternalStore
  // сравнивает по ссылке и на новом массиве каждый раз ушёл бы в цикл.
  if (next.length === snapshot.length && next.every((id, i) => id === snapshot[i])) {
    return;
  }
  snapshot = next;
  for (const listener of listeners) listener();
}

export function getOnline(): string[] {
  return snapshot;
}

export function subscribeOnline(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function joinPresence(familyId: string, userId: string): void {
  if (!supabase) return;
  const room = `family:${familyId}:${userId}`;
  if (joined === room) return;

  leavePresence();
  joined = room;

  const next = supabase.channel(`presence:family:${familyId}`, {
    config: { presence: { key: userId } },
  });

  next.on("presence", { event: "sync" }, () => {
    update(Object.keys(next.presenceState()));
  });

  void next.subscribe((state) => {
    if (state === "SUBSCRIBED") void next.track({ at: Date.now() });
  });

  channel = next;
}

export function leavePresence(): void {
  joined = "";
  update([]);
  if (channel && supabase) void supabase.removeChannel(channel);
  channel = null;
}
