/* ---------------------------------------------------------------
   Реактивные хуки над локальной базой.

   Любая запись через repo вызывает notifyChange(), после чего все
   хуки перечитывают свои данные. Для приложения такого размера это
   проще и предсказуемее, чем кэш-менеджер.
   --------------------------------------------------------------- */

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { getVersion, listAll, subscribe } from "./repo";
import { getSettings, subscribeSettings } from "./settings";
import type { Child, Settings } from "./types";

/** Счётчик изменений базы: растёт после каждой записи. */
export function useDataVersion(): number {
  return useSyncExternalStore(subscribe, getVersion, getVersion);
}

export function useSettings(): Settings {
  return useSyncExternalStore(subscribeSettings, getSettings, getSettings);
}

export interface LiveResult<T> {
  data: T | undefined;
  loading: boolean;
  error: Error | null;
}

/**
 * Выполняет асинхронный запрос к базе и повторяет его при любом
 * изменении данных или при смене `deps`.
 */
export function useLive<T>(
  loader: () => Promise<T>,
  deps: readonly unknown[] = [],
): LiveResult<T> {
  const version = useDataVersion();
  const [state, setState] = useState<LiveResult<T>>({
    data: undefined,
    loading: true,
    error: null,
  });

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(loader, deps);

  useEffect(() => {
    let cancelled = false;
    run().then(
      (data) => {
        if (!cancelled) setState({ data, loading: false, error: null });
      },
      (error: Error) => {
        if (!cancelled) setState({ data: undefined, loading: false, error });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [run, version]);

  return state;
}

export function useChildren(): LiveResult<Child[]> {
  return useLive(async () => {
    const rows = await listAll("children");
    return rows.sort((a, b) => a.birth_date.localeCompare(b.birth_date));
  }, []);
}

/** Текущий выбранный ребёнок. Если выбранного нет — первый в списке. */
export function useActiveChild(): {
  child: Child | null;
  children: Child[];
  loading: boolean;
} {
  const settings = useSettings();
  const { data: children, loading } = useChildren();
  const list = children ?? [];
  const child =
    list.find((item) => item.id === settings.activeChildId) ?? list[0] ?? null;
  return { child, children: list, loading };
}

/** Тикающие «сейчас» — для таймеров. По умолчанию раз в секунду. */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    // Вкладку могли усыпить — при возврате сразу подтягиваем время.
    const onVisible = () => {
      if (!document.hidden) setNow(Date.now());
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [intervalMs]);
  return now;
}
