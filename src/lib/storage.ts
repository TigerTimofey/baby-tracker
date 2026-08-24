export interface StorageStatus {
  supported: boolean;
  persisted: boolean;
  usageBytes: number | null;
  quotaBytes: number | null;
}

const ASKED_KEY = "malysh.storagePersistAsked";

export function storagePersistSupported(): boolean {
  return (
    typeof navigator !== "undefined" &&
    "storage" in navigator &&
    typeof navigator.storage.persist === "function"
  );
}

export async function readStorageStatus(): Promise<StorageStatus> {
  if (!storagePersistSupported()) {
    return {
      supported: false,
      persisted: false,
      usageBytes: null,
      quotaBytes: null,
    };
  }

  let persisted = false;
  try {
    persisted = await navigator.storage.persisted();
  } catch {
    persisted = false;
  }

  let usageBytes: number | null = null;
  let quotaBytes: number | null = null;
  try {
    const estimate = await navigator.storage.estimate();
    usageBytes = estimate.usage ?? null;
    quotaBytes = estimate.quota ?? null;
  } catch {
    void 0;
  }

  return { supported: true, persisted, usageBytes, quotaBytes };
}

export async function requestPersistentStorage(): Promise<boolean> {
  if (!storagePersistSupported()) return false;
  try {
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

/** Просим один раз за установку: повторные отказы браузер всё равно не меняет. */
export async function ensurePersistentStorageOnce(): Promise<void> {
  if (!storagePersistSupported()) return;
  try {
    if (await navigator.storage.persisted()) return;
    if (localStorage.getItem(ASKED_KEY)) return;
    localStorage.setItem(ASKED_KEY, "1");
    await navigator.storage.persist();
  } catch {
    void 0;
  }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} КБ`;
  return `${(bytes / (1024 * 1024)).toLocaleString("ru-RU", {
    maximumFractionDigits: 1,
  })} МБ`;
}
