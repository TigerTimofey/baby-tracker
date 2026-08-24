import { getDB, getLooseDB } from "./db";
import type { Local, TableMap, TableName } from "./types";

type Listener = () => void;

const listeners = new Set<Listener>();
let version = 0;

const channel =
  typeof BroadcastChannel !== "undefined"
    ? new BroadcastChannel("malysh-data")
    : null;

if (channel) {
  channel.onmessage = () => {
    version++;
    for (const listener of listeners) listener();
  };
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getVersion(): number {
  return version;
}

export function notifyChange(): void {
  version++;
  for (const listener of listeners) listener();
  channel?.postMessage("changed");
}

export function newId(): string {
  return crypto.randomUUID();
}

export function nowISO(): string {
  return new Date().toISOString();
}

export async function listAll<K extends TableName>(
  table: K,
): Promise<Local<TableMap[K]>[]> {
  const db = await getLooseDB();
  const rows = (await db.getAll(table)) as Local<TableMap[K]>[];
  return rows.filter((row) => !row.deleted);
}

export async function listByChild<K extends Exclude<TableName, "children">>(
  table: K,
  childId: string,
): Promise<Local<TableMap[K]>[]> {
  const db = await getLooseDB();
  const rows = (await db.getAllFromIndex(
    table,
    "by_child",
    childId,
  )) as Local<TableMap[K]>[];
  return rows.filter((row) => !row.deleted);
}

export async function getOne<K extends TableName>(
  table: K,
  id: string,
): Promise<Local<TableMap[K]> | undefined> {
  const db = await getLooseDB();
  return (await db.get(table, id)) as Local<TableMap[K]> | undefined;
}

export async function listDirty<K extends TableName>(
  table: K,
): Promise<Local<TableMap[K]>[]> {
  const db = await getLooseDB();
  return (await db.getAllFromIndex(table, "by_dirty", 1)) as Local<
    TableMap[K]
  >[];
}

export async function countDirty(): Promise<number> {
  const db = await getDB();
  let total = 0;
  for (const table of [
    "children",
    "sleep_sessions",
    "measurements",
    "milestones",
    "feedings",
    "diapers",
  ] as const) {
    total += await db.countFromIndex(table, "by_dirty", 1);
  }
  return total;
}

export async function save<K extends TableName>(
  table: K,
  record: TableMap[K],
): Promise<TableMap[K]> {
  const row = { ...record, updated_at: nowISO() };

  const db = await getLooseDB();
  await db.put(table, { ...row, _dirty: 1 });
  notifyChange();
  return row;
}

export async function softDelete<K extends TableName>(
  table: K,
  id: string,
): Promise<void> {
  const existing = await getOne(table, id);
  if (!existing) return;

  const db = await getLooseDB();
  await db.put(table, {
    ...existing,
    deleted: true,
    updated_at: nowISO(),
    _dirty: 1,
  });
  notifyChange();
}

export async function applyRemote<K extends TableName>(
  table: K,
  record: TableMap[K],
): Promise<void> {
  const db = await getLooseDB();
  await db.put(table, { ...record, _dirty: 0 });
}

export async function clearDirty<K extends TableName>(
  table: K,
  id: string,
  sentUpdatedAt: string,
): Promise<void> {
  const db = await getLooseDB();
  const current = (await db.get(table, id)) as Local<TableMap[K]> | undefined;
  if (!current || current.updated_at !== sentUpdatedAt) return;
  await db.put(table, { ...current, _dirty: 0 });
}
