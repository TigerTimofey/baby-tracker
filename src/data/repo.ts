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

let authorProvider: () => string | null = () => null;

export function setAuthorProvider(provider: () => string | null): void {
  authorProvider = provider;
}

export function currentAuthor(): string | null {
  return authorProvider();
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
  const row = {
    ...record,
    updated_at: nowISO(),
    created_by: record.created_by ?? authorProvider(),
  };

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

export async function restore<K extends TableName>(
  table: K,
  id: string,
): Promise<void> {
  const existing = await getOne(table, id);
  if (!existing) return;

  const db = await getLooseDB();
  await db.put(table, {
    ...existing,
    deleted: false,
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

const CHILD_TABLES = [
  "sleep_sessions",
  "measurements",
  "milestones",
  "feedings",
  "diapers",
] as const;

export interface ChildRecordCounts {
  sleep_sessions: number;
  measurements: number;
  milestones: number;
  feedings: number;
  diapers: number;
  total: number;
}

export async function countChildRecords(
  childId: string,
): Promise<ChildRecordCounts> {
  const counts = {
    sleep_sessions: 0,
    measurements: 0,
    milestones: 0,
    feedings: 0,
    diapers: 0,
    total: 0,
  };

  for (const table of CHILD_TABLES) {
    const rows = await listByChild(table, childId);
    counts[table] = rows.length;
    counts.total += rows.length;
  }

  return counts;
}

export interface DeletedChild {
  childId: string;
  removed: Partial<Record<TableName, string[]>>;
}

export async function deleteChildDeep(childId: string): Promise<DeletedChild> {
  const db = await getLooseDB();
  const stamp = nowISO();
  const removed: Partial<Record<TableName, string[]>> = {};

  for (const table of CHILD_TABLES) {
    const rows = (await db.getAllFromIndex(table, "by_child", childId)) as {
      id: string;
      deleted: boolean;
    }[];
    const ids: string[] = [];
    for (const row of rows) {
      if (row.deleted) continue;
      await db.put(table, { ...row, deleted: true, updated_at: stamp, _dirty: 1 });
      ids.push(row.id);
    }
    if (ids.length) removed[table] = ids;
  }

  const child = (await db.get("children", childId)) as
    | { deleted: boolean }
    | undefined;
  if (child && !child.deleted) {
    await db.put("children", {
      ...child,
      deleted: true,
      updated_at: stamp,
      _dirty: 1,
    });
    removed.children = [childId];
  }

  notifyChange();
  return { childId, removed };
}

export async function restoreChildDeep(token: DeletedChild): Promise<void> {
  const db = await getLooseDB();
  const stamp = nowISO();

  for (const [table, ids] of Object.entries(token.removed)) {
    for (const id of ids) {
      const row = await db.get(table, id);
      if (!row) continue;
      await db.put(table, {
        ...row,
        deleted: false,
        updated_at: stamp,
        _dirty: 1,
      });
    }
  }

  notifyChange();
}
