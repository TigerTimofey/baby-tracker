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
  setAuthorProvider,
  subscribe as subscribeData,
} from "./repo";
import { TABLES, type Child, type TableMap, type TableName } from "./types";

export type SyncState =
  | "checking"
  | "disabled"
  | "signed_out"
  | "offline"
  | "idle"
  | "syncing"
  | "error";

export interface FamilyMember {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
}

export interface SyncStatus {
  state: SyncState;
  email: string | null;
  userId: string | null;
  members: FamilyMember[];
  familyId: string | null;
  inviteCode: string | null;
  pending: number;
  lastSyncAt: string | null;
  error: string | null;
}

let status: SyncStatus = {
  state: isSupabaseConfigured ? "checking" : "disabled",
  email: null,
  userId: null,
  members: [],
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
        prompt: "select_account",
      },
    },
  });
  if (error) throw new Error(error.message);
}

export async function requestCode(email: string): Promise<void> {
  const client = requireClient();
  const { error } = await client.auth.signInWithOtp({
    email: email.trim(),
    options: { shouldCreateUser: true },
  });
  if (error) throw new Error(error.message);
}

export async function verifyCode(email: string, code: string): Promise<void> {
  const client = requireClient();
  const { error } = await client.auth.verifyOtp({
    email: email.trim(),
    token: code.trim(),
    type: "email",
  });
  if (error) throw new Error(error.message);
}

export async function signOutSync(): Promise<void> {
  const client = requireClient();
  await client.auth.signOut();
  for (const table of TABLES) await metaDelete(cursorKey(table));
  await metaDelete("family_id");
  setStatus({
    state: "signed_out",
    email: null,
    userId: null,
    members: [],
    familyId: null,
    inviteCode: null,
    error: null,
  });
}

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

  await refreshMembers(familyId);

  return familyId;
}

interface SessionUser {
  email?: string | null;
  user_metadata?: Record<string, unknown>;
}

function nameFromSession(user: SessionUser): string | null {
  const meta = user.user_metadata ?? {};

  const given = meta.given_name as string | undefined;
  if (given && given.trim()) return given.trim();

  const full = (meta.full_name ?? meta.name) as string | undefined;
  if (full && full.trim()) return full.trim().split(/\s+/)[0];

  const email = user.email ?? "";
  return email.includes("@") ? email.split("@")[0] : null;
}

function avatarFromSession(user: SessionUser): string | null {
  const meta = user.user_metadata ?? {};
  const url = (meta.avatar_url ?? meta.picture) as string | undefined;
  return url && url.startsWith("http") ? url : null;
}

async function refreshMembers(familyId: string): Promise<void> {
  const client = requireClient();

  const { data: sessionData } = await client.auth.getSession();
  const user = sessionData.session?.user;
  if (!user) return;

  const listed = await client
    .from("family_members")
    .select("user_id, display_name, avatar_url")
    .eq("family_id", familyId);
  if (listed.error) return;

  let members = (listed.data ?? []) as FamilyMember[];
  const me = members.find((member) => member.user_id === user.id);
  const myName = nameFromSession(user);
  const myAvatar = avatarFromSession(user);

  const patch: { display_name?: string; avatar_url?: string } = {};
  if (myName && me?.display_name !== myName) patch.display_name = myName;
  if (myAvatar && me?.avatar_url !== myAvatar) patch.avatar_url = myAvatar;

  if (me && Object.keys(patch).length > 0) {
    await client
      .from("family_members")
      .update(patch)
      .eq("family_id", familyId)
      .eq("user_id", user.id);
    members = members.map((member) =>
      member.user_id === user.id ? { ...member, ...patch } : member,
    );
  }

  setStatus({ members });
}

export function authorName(userId: string | null): string | null {
  if (!userId) return null;
  if (userId === status.userId) return "вы";
  const member = status.members.find((item) => item.user_id === userId);
  return member?.display_name ?? "второй родитель";
}

export function authorLabel(createdBy: string | null): string | null {
  if (!createdBy || status.members.length < 2) return null;
  if (createdBy === status.userId) return "вы";
  const member = status.members.find((item) => item.user_id === createdBy);
  return member?.display_name ?? "второй родитель";
}

export async function joinFamily(code: string): Promise<void> {
  const client = requireClient();
  const { error } = await client.rpc("join_family", { code: code.trim() });
  if (error) throw new Error(error.message);

  for (const table of TABLES) await metaDelete(cursorKey(table));
  await ensureFamily();
  await syncNow();
}

const EPOCH = "1970-01-01T00:00:00.000Z";
const PAGE_SIZE = 500;

function cursorKey(table: TableName): string {
  return `cursor:${table}`;
}

function toPayload(row: Record<string, unknown>): Record<string, unknown> {
  const { _dirty, synced_at, ...rest } = row;
  void _dirty;
  void synced_at;
  return rest;
}

type AnyRecord = TableMap[TableName];

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

    if (table === "children") clean.family_id = familyId;
    if (clean.created_by == null) clean.created_by = status.userId;
    return clean;
  });

  const { error } = await client.from(table).upsert(payload, {
    onConflict: "id",
  });
  if (error) throw new Error(`Отправка «${table}»: ${error.message}`);

  for (const row of dirty) {
    await clearDirty(table, row.id, row.updated_at);
  }

  if (table === "children") {
    for (const row of dirty as unknown as Child[]) {
      if (row.family_id) continue;
      const current = await getOne("children", row.id);

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

      // Одна нерабочая таблица не должна останавливать остальные: пока в
      // базе нет свежей таблицы, сон и кормления обязаны продолжать ездить.
      // Несохранённые строки остаются грязными и уйдут на следующем круге.
      const failures: string[] = [];
      const note = (cause: unknown) => {
        const text = cause instanceof Error ? cause.message : String(cause);
        if (!failures.includes(text)) failures.push(text);
      };

      for (const table of TABLES) {
        try {
          await pushTable(table, familyId);
        } catch (cause) {
          note(cause);
        }
      }

      let changed = false;
      for (const table of TABLES) {
        try {
          if (await pullTable(table)) changed = true;
        } catch (cause) {
          note(cause);
        }
      }
      if (changed) notifyChange();

      if (failures.length > 0) {
        setStatus({
          state: "error",
          error:
            failures.length === 1
              ? failures[0]
              : `${failures[0]} (и ещё ${failures.length - 1})`,
        });
      } else {
        setStatus({
          state: "idle",
          lastSyncAt: new Date().toISOString(),
          error: null,
        });
      }
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

const AUTO_SYNC_MS = 60_000;
const CHANGE_SYNC_DELAY_MS = 2500;

export function initSync(): () => void {
  void refreshPending();
  setAuthorProvider(() => status.userId);

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
    setStatus({ email: session.user.email ?? null, userId: session.user.id });

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
    if (status.email) setStatus({ state: "offline" });
  };
  window.addEventListener("offline", onOffline);
  document.addEventListener("visibilitychange", onVisible);

  const timer = setInterval(() => void syncNow(), AUTO_SYNC_MS);

  let changeTimer: ReturnType<typeof setTimeout> | undefined;
  const unsubscribeData = subscribeData(() => {
    void refreshPending().then(() => {
      if (status.pending === 0) return;
      if (changeTimer) clearTimeout(changeTimer);
      changeTimer = setTimeout(() => void syncNow(), CHANGE_SYNC_DELAY_MS);
    });
  });

  void syncNow();

  return () => {
    authSub.subscription.unsubscribe();
    window.removeEventListener("online", onOnline);
    window.removeEventListener("offline", onOffline);
    document.removeEventListener("visibilitychange", onVisible);
    clearInterval(timer);
    if (changeTimer) clearTimeout(changeTimer);
    unsubscribeData();
  };
}
