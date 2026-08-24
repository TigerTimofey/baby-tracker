/* ---------------------------------------------------------------
   Синхронизация локальной базы с Supabase.

   Правила простые и предсказуемые:
     • Локальная база — источник правды для интерфейса. Синхронизация
       никогда не блокирует ввод данных.
     • Отправляем всё, что помечено `_dirty`.
     • Забираем всё, что на сервере изменилось после нашего курсора.
     • Конфликт решается по `updated_at`: побеждает более поздняя
       запись. Для семейного дневника этого достаточно — двое родителей
       редко правят одну и ту же запись в одну и ту же секунду.
   --------------------------------------------------------------- */

import {
  isSupabaseConfigured,
  supabase,
  supabaseAnonKey,
  supabaseUrl,
} from "../lib/supabase";
import { updateSettings } from "./settings";
import { metaDelete, metaGet, metaSet } from "./db";
import {
  applyRemote,
  clearDirty,
  countDirty,
  getOne,
  listDirty,
  notifyChange,
  subscribe as subscribeData,
} from "./repo";
import { TABLES, type Child, type TableMap, type TableName } from "./types";

/* --------------------------------- статус --------------------------------- */

export type SyncState =
  /** Ещё не знаем, есть ли действующий вход. Показывать экран входа рано. */
  | "checking"
  /** Ключи Supabase не заданы — работаем полностью локально. */
  | "disabled"
  /** Ключи есть, но пользователь не вошёл в аккаунт. */
  | "signed_out"
  | "offline"
  | "idle"
  | "syncing"
  | "error";

export interface SyncStatus {
  state: SyncState;
  email: string | null;
  familyId: string | null;
  /** Код, по которому второй родитель присоединяется к семье. */
  inviteCode: string | null;
  /** Сколько записей ждут отправки. */
  pending: number;
  lastSyncAt: string | null;
  error: string | null;
}

let status: SyncStatus = {
  state: isSupabaseConfigured ? "checking" : "disabled",
  email: null,
  familyId: null,
  inviteCode: null,
  pending: 0,
  lastSyncAt: null,
  error: null,
};

const statusListeners = new Set<() => void>();

export function getSyncStatus(): SyncStatus {
  return status;
}

export function subscribeSync(listener: () => void): () => void {
  statusListeners.add(listener);
  return () => {
    statusListeners.delete(listener);
  };
}

function setStatus(patch: Partial<SyncStatus>): void {
  status = { ...status, ...patch };
  for (const listener of statusListeners) listener();
}

async function refreshPending(): Promise<void> {
  setStatus({ pending: await countDirty() });
}

/* ---------------------------------- вход ---------------------------------- */

function requireClient(): NonNullable<typeof supabase> {
  if (!supabase) {
    throw new Error(
      "Синхронизация не настроена: не заданы VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY",
    );
  }
  return supabase;
}

export interface EnabledProviders {
  google: boolean;
  email: boolean;
}

/**
 * Какие способы входа включены в проекте Supabase.
 *
 * Нужно, чтобы не отправлять человека на страницу, которая ответит
 * «provider is not enabled» и оставит его на голой JSON-ошибке без пути
 * назад. Если запрос не удался — не мешаем: показываем кнопку как есть.
 */
export async function fetchEnabledProviders(): Promise<EnabledProviders | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/settings`, {
      headers: { apikey: supabaseAnonKey },
    });
    if (!response.ok) return null;
    const data = (await response.json()) as {
      external?: Record<string, boolean>;
    };
    return {
      google: data.external?.google === true,
      email: data.external?.email !== false,
    };
  } catch {
    return null;
  }
}

/**
 * Вход через Google.
 *
 * Уводит на страницу Google и возвращает обратно с кодом, который
 * supabase-js обменивает на сессию сам. Google client ID и secret
 * задаются в панели Supabase, а не здесь: secret нельзя держать в коде,
 * который уезжает в браузер.
 */
export async function signInWithGoogle(): Promise<void> {
  const client = requireClient();

  const redirectTo =
    import.meta.env.VITE_AUTH_REDIRECT_URL?.trim() ||
    window.location.origin + window.location.pathname;

  const { error } = await client.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      queryParams: {
        // Просим выбрать аккаунт: на общем компьютере это важнее удобства.
        prompt: "select_account",
      },
    },
  });
  if (error) throw new Error(error.message);
}

/** Шаг 1: отправить письмо с кодом входа. */
export async function requestCode(email: string): Promise<void> {
  const client = requireClient();
  const { error } = await client.auth.signInWithOtp({
    email: email.trim(),
    options: { shouldCreateUser: true },
  });
  if (error) throw new Error(error.message);
}

/** Шаг 2: подтвердить код из письма. */
export async function verifyCode(email: string, code: string): Promise<void> {
  const client = requireClient();
  const { error } = await client.auth.verifyOtp({
    email: email.trim(),
    token: code.trim(),
    type: "email",
  });
  if (error) throw new Error(error.message);
}

/**
 * Выход из аккаунта.
 *
 * Локальные данные намеренно остаются на устройстве: это дневник
 * собственного ребёнка, стирать его при выходе — верный способ
 * потерять записи. Сбрасываем только курсоры, чтобы при следующем
 * входе всё перечиталось с сервера заново.
 */
export async function signOutSync(): Promise<void> {
  const client = requireClient();
  await client.auth.signOut();
  for (const table of TABLES) await metaDelete(cursorKey(table));
  await metaDelete("family_id");
  setStatus({
    state: "signed_out",
    email: null,
    familyId: null,
    inviteCode: null,
    error: null,
  });
}

/* ---------------------------------- семья --------------------------------- */

/** Находит семью пользователя, а если её нет — создаёт. */
async function ensureFamily(): Promise<string | null> {
  const client = requireClient();

  const existing = await client.rpc("my_family_id");
  if (existing.error) throw new Error(existing.error.message);

  let familyId = existing.data as string | null;

  if (!familyId) {
    const created = await client.rpc("create_family", {
      family_name: "Моя семья",
    });
    if (created.error) throw new Error(created.error.message);
    familyId = created.data as string;
  }

  await metaSet("family_id", familyId);

  const family = await client
    .from("families")
    .select("invite_code")
    .eq("id", familyId)
    .maybeSingle();

  setStatus({
    familyId,
    inviteCode: (family.data?.invite_code as string | undefined) ?? null,
  });

  return familyId;
}

/** Присоединиться к семье второго родителя по коду приглашения. */
export async function joinFamily(code: string): Promise<void> {
  const client = requireClient();
  const { error } = await client.rpc("join_family", { code: code.trim() });
  if (error) throw new Error(error.message);

  // Семья сменилась — читаем данные новой семьи с самого начала.
  for (const table of TABLES) await metaDelete(cursorKey(table));
  await ensureFamily();
  await syncNow();
}

/* ------------------------------ синхронизация ------------------------------ */

const EPOCH = "1970-01-01T00:00:00.000Z";
const PAGE_SIZE = 500;

function cursorKey(table: TableName): string {
  return `cursor:${table}`;
}

/** Убираем локальные и серверные служебные поля перед отправкой. */
function toPayload(row: Record<string, unknown>): Record<string, unknown> {
  const { _dirty, synced_at, ...rest } = row;
  void _dirty;
  void synced_at;
  return rest;
}

/** Любая синхронизируемая запись, без привязки к конкретной таблице. */
type AnyRecord = TableMap[TableName];

/** Убираем серверные поля перед записью в локальную базу. */
function fromRemote(row: Record<string, unknown>): AnyRecord {
  const { synced_at, ...rest } = row;
  void synced_at;
  return rest as unknown as AnyRecord;
}

async function pushTable(table: TableName, familyId: string): Promise<void> {
  const client = requireClient();
  const dirty = await listDirty(table);
  if (dirty.length === 0) return;

  const payload = dirty.map((row) => {
    const clean = toPayload(row as unknown as Record<string, unknown>);
    // Ребёнок мог быть заведён до входа в аккаунт — привязываем к семье.
    if (table === "children") clean.family_id = familyId;
    return clean;
  });

  const { error } = await client.from(table).upsert(payload, {
    onConflict: "id",
  });
  if (error) throw new Error(`Отправка «${table}»: ${error.message}`);

  for (const row of dirty) {
    await clearDirty(table, row.id, row.updated_at);
  }

  // Локальные дети без family_id — дописываем, чтобы состояние сошлось.
  if (table === "children") {
    for (const row of dirty as unknown as Child[]) {
      if (row.family_id) continue;
      const current = await getOne("children", row.id);
      // Запись успели изменить, пока шёл запрос — не трогаем её флаг.
      if (!current || current.family_id || current._dirty === 1) continue;
      const { _dirty, ...rest } = current;
      await applyRemote("children", { ...rest, family_id: familyId });
    }
  }
}

async function pullTable(table: TableName): Promise<boolean> {
  const client = requireClient();
  let cursor = (await metaGet<string>(cursorKey(table))) ?? EPOCH;
  let changed = false;

  for (;;) {
    const { data, error } = await client
      .from(table)
      .select("*")
      .gt("synced_at", cursor)
      .order("synced_at", { ascending: true })
      .limit(PAGE_SIZE);

    if (error) throw new Error(`Загрузка «${table}»: ${error.message}`);
    const rows = (data ?? []) as Record<string, unknown>[];
    if (rows.length === 0) break;

    for (const row of rows) {
      const record = fromRemote(row);
      const local = await getOne(table, record.id);

      // Наша версия новее и ещё не отправлена — сохраняем её, уедет позже.
      if (local && local._dirty === 1 && local.updated_at > record.updated_at) {
        continue;
      }
      if (local && local.updated_at === record.updated_at && !local._dirty) {
        continue;
      }

      await applyRemote(table, record);
      changed = true;
    }

    cursor = rows[rows.length - 1].synced_at as string;
    await metaSet(cursorKey(table), cursor);

    if (rows.length < PAGE_SIZE) break;
  }

  return changed;
}

let syncInFlight: Promise<void> | null = null;

/** Полный цикл: отправить своё, забрать чужое. Повторные вызовы схлопываются. */
export async function syncNow(): Promise<void> {
  if (!isSupabaseConfigured) return;
  if (syncInFlight) return syncInFlight;

  syncInFlight = (async () => {
    const client = requireClient();

    const { data: sessionData } = await client.auth.getSession();
    if (!sessionData.session) {
      setStatus({ state: "signed_out" });
      return;
    }
    if (!navigator.onLine) {
      setStatus({ state: "offline" });
      return;
    }

    setStatus({ state: "syncing", error: null });

    try {
      const familyId = status.familyId ?? (await ensureFamily());
      if (!familyId) throw new Error("Не удалось определить семью");

      // Порядок важен: сначала дети, потом всё, что на них ссылается.
      for (const table of TABLES) await pushTable(table, familyId);

      let changed = false;
      for (const table of TABLES) {
        if (await pullTable(table)) changed = true;
      }
      if (changed) notifyChange();

      setStatus({
        state: "idle",
        lastSyncAt: new Date().toISOString(),
        error: null,
      });
    } catch (error) {
      setStatus({
        state: "error",
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      await refreshPending();
    }
  })();

  try {
    await syncInFlight;
  } finally {
    syncInFlight = null;
  }
}

/* ---------------------------------- запуск --------------------------------- */

const AUTO_SYNC_MS = 60_000;

/** Подключает автосинхронизацию. Возвращает функцию отключения. */
export function initSync(): () => void {
  void refreshPending();

  if (!isSupabaseConfigured || !supabase) {
    setStatus({ state: "disabled" });
    return () => {};
  }

  const client = supabase;

  const { data: authSub } = client.auth.onAuthStateChange((_event, session) => {
    if (!session) {
      setStatus({ state: "signed_out", email: null, familyId: null });
      return;
    }
    setStatus({ email: session.user.email ?? null });
    // Вошли — значит от работы «только на этом устройстве» отказались.
    updateSettings({ localOnly: false });
    void metaGet<string>("family_id").then((saved) => {
      if (saved) setStatus({ familyId: saved });
      void syncNow();
    });
  });

  const onOnline = () => void syncNow();
  const onVisible = () => {
    if (!document.hidden) void syncNow();
  };

  window.addEventListener("online", onOnline);
  const onOffline = () => {
    // Только для вошедшего: иначе потеря сети сбросила бы экран входа.
    if (status.email) setStatus({ state: "offline" });
  };
  window.addEventListener("offline", onOffline);
  document.addEventListener("visibilitychange", onVisible);

  const timer = setInterval(() => void syncNow(), AUTO_SYNC_MS);
  const unsubscribeData = subscribeData(() => void refreshPending());

  void syncNow();

  return () => {
    authSub.subscription.unsubscribe();
    window.removeEventListener("online", onOnline);
    window.removeEventListener("offline", onOffline);
    document.removeEventListener("visibilitychange", onVisible);
    clearInterval(timer);
    unsubscribeData();
  };
}

