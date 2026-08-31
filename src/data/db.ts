import { t } from "../lib/i18n";
import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type {
  Child,
  Diaper,
  Feeding,
  Local,
  Measurement,
  Milestone,
  SleepSession,
  Medicine,
  Temperature,
} from "./types";

const DB_NAME = "malysh";
const DB_VERSION = 3;

interface BabyDB extends DBSchema {
  children: {
    key: string;
    value: Local<Child>;
    indexes: { by_dirty: number };
  };
  sleep_sessions: {
    key: string;
    value: Local<SleepSession>;
    indexes: { by_dirty: number; by_child: string };
  };
  measurements: {
    key: string;
    value: Local<Measurement>;
    indexes: { by_dirty: number; by_child: string };
  };
  milestones: {
    key: string;
    value: Local<Milestone>;
    indexes: { by_dirty: number; by_child: string };
  };
  feedings: {
    key: string;
    value: Local<Feeding>;
    indexes: { by_dirty: number; by_child: string };
  };
  diapers: {
    key: string;
    value: Local<Diaper>;
    indexes: { by_dirty: number; by_child: string };
  };
  temperatures: {
    key: string;
    value: Local<Temperature>;
    indexes: { by_dirty: number; by_child: string };
  };
  medicines: {
    key: string;
    value: Local<Medicine>;
    indexes: { by_dirty: number; by_child: string };
  };
  meta: { key: string; value: unknown };
}

export type BabyDatabase = IDBPDatabase<BabyDB>;

let dbPromise: Promise<BabyDatabase> | null = null;

export function getDB(): Promise<BabyDatabase> {
  if (!dbPromise) {
    dbPromise = openDB<BabyDB>(DB_NAME, DB_VERSION, {
      // Апгрейд идёт и на пустой базе, и на уже заполненной, поэтому каждый
      // шаг проверяет, чего не хватает: иначе второй запуск падал бы на
      // попытке создать существующее хранилище.
      upgrade(db) {
        if (!db.objectStoreNames.contains("children")) {
          const children = db.createObjectStore("children", { keyPath: "id" });
          children.createIndex("by_dirty", "_dirty");
        }

        for (const name of [
          "sleep_sessions",
          "measurements",
          "milestones",
          "feedings",
          "diapers",
          "temperatures",
          "medicines",
        ] as const) {
          if (db.objectStoreNames.contains(name)) continue;
          const store = db.createObjectStore(name, { keyPath: "id" });
          store.createIndex("by_dirty", "_dirty");
          store.createIndex("by_child", "child_id");
        }

        if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta");
      },
      blocked() {
        console.warn(t("[db] обновление схемы ждёт закрытия другой вкладки"));
      },
    });
  }
  return dbPromise;
}

export async function metaGet<T>(key: string): Promise<T | undefined> {
  const db = await getDB();
  return (await db.get("meta", key)) as T | undefined;
}

export async function metaSet(key: string, value: unknown): Promise<void> {
  const db = await getDB();
  await db.put("meta", value, key);
}

export async function metaDelete(key: string): Promise<void> {
  const db = await getDB();
  await db.delete("meta", key);
}

export async function getLooseDB(): Promise<IDBPDatabase> {
  return (await getDB()) as unknown as IDBPDatabase;
}
