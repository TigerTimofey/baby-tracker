/* ---------------------------------------------------------------
   Локальная база (IndexedDB).

   Это источник правды для интерфейса: приложение целиком работает без
   интернета, а Supabase — «второй экземпляр», с которым мы сверяемся,
   когда сеть есть. Ночью в детской с плохим Wi-Fi таймер сна должен
   запускаться мгновенно.
   --------------------------------------------------------------- */

import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type {
  Child,
  Diaper,
  Feeding,
  Local,
  Measurement,
  Milestone,
  SleepSession,
} from "./types";

const DB_NAME = "malysh";
const DB_VERSION = 1;

/** Индексы: `by_dirty` — что отправить на сервер, `by_child` — выборка по ребёнку. */
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
  meta: { key: string; value: unknown };
}

export type BabyDatabase = IDBPDatabase<BabyDB>;

let dbPromise: Promise<BabyDatabase> | null = null;

export function getDB(): Promise<BabyDatabase> {
  if (!dbPromise) {
    dbPromise = openDB<BabyDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const children = db.createObjectStore("children", { keyPath: "id" });
        children.createIndex("by_dirty", "_dirty");

        for (const name of [
          "sleep_sessions",
          "measurements",
          "milestones",
          "feedings",
          "diapers",
        ] as const) {
          const store = db.createObjectStore(name, { keyPath: "id" });
          store.createIndex("by_dirty", "_dirty");
          store.createIndex("by_child", "child_id");
        }

        db.createObjectStore("meta");
      },
      blocked() {
        console.warn("[db] обновление схемы ждёт закрытия другой вкладки");
      },
    });
  }
  return dbPromise;
}

/* -------------------------- служебные значения -------------------------- */

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

/**
 * Нетипизированный вид той же базы.
 *
 * Обобщённые функции репозитория работают с именем таблицы как с
 * параметром типа, а строгая схема idb такое не переваривает —
 * пытается свести все шесть типов записей в один и получает `never`.
 * Типобезопасность при этом остаётся на уровне репозитория, где имя
 * таблицы и тип записи связаны через `TableMap`.
 */
export async function getLooseDB(): Promise<IDBPDatabase> {
  return (await getDB()) as unknown as IDBPDatabase;
}
