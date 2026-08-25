import { DEFAULT_SETTINGS, type Settings } from "./types";

const KEY = "malysh.settings";

function read(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

let current = read();

const listeners = new Set<() => void>();

export function getSettings(): Settings {
  return current;
}

export function subscribeSettings(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function updateSettings(patch: Partial<Settings>): void {
  current = { ...current, ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    void 0;
  }
  applyTheme();
  for (const listener of listeners) listener();
}

function minutesOfDay(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 23 || m > 59) return null;
  return h * 60 + m;
}

export function isNightWindow(
  from: string,
  to: string,
  now: Date = new Date(),
): boolean {
  const start = minutesOfDay(from);
  const end = minutesOfDay(to);
  if (start === null || end === null) return false;

  const current = now.getHours() * 60 + now.getMinutes();
  if (start === end) return true;
  return start < end
    ? current >= start && current < end
    : current >= start || current < end;
}

export function nightActive(now: Date = new Date()): boolean {
  return (
    current.nightMode &&
    isNightWindow(current.nightFrom, current.nightTo, now)
  );
}

const THEME_COLORS: Record<string, string> = {
  light: "#f7f5fb",
  dark: "#12121b",
  night: "#050403",
};

export function applyTheme(): void {
  const { theme } = current;
  const night = nightActive();
  const resolved =
    theme === "system"
      ? window.matchMedia("(prefers-color-scheme: light)").matches
        ? "light"
        : "dark"
      : theme;

  const root = document.documentElement;
  root.dataset.theme = resolved;
  if (night) root.dataset.night = "on";
  else delete root.dataset.night;

  let meta = document.querySelector<HTMLMetaElement>(
    'meta[name="theme-color"]',
  );
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = "theme-color";
    document.head.prepend(meta);
  }
  meta.content = THEME_COLORS[night ? "night" : resolved];
}
