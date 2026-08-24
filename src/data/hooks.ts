import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { getVersion, listAll, subscribe } from "./repo";
import { getSettings, subscribeSettings } from "./settings";
import { authorLabel, getSyncStatus, subscribeSync } from "./sync";
import type { Child, Settings } from "./types";

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

  const loaderRef = useRef(loader);
  useEffect(() => {
    loaderRef.current = loader;
  });

  const depsKey = JSON.stringify(deps);

  useEffect(() => {
    let cancelled = false;
    loaderRef.current().then(
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
  }, [depsKey, version]);

  return state;
}

export function useChildren(): LiveResult<Child[]> {
  return useLive(async () => {
    const rows = await listAll("children");
    return rows.sort((a, b) => a.birth_date.localeCompare(b.birth_date));
  }, []);
}

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

export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);

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

export function useAuthorLabel(): (createdBy: string | null) => string | null {
  const status = useSyncExternalStore(
    subscribeSync,
    getSyncStatus,
    getSyncStatus,
  );
  void status.members;
  return authorLabel;
}
