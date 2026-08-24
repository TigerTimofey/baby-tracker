/* ---------------------------------------------------------------
   Модель данных.

   Все сущности сразу описаны здесь (сон, измерения, вехи, кормления,
   подгузники) — даже те, что ещё не реализованы в интерфейсе. Так схема
   базы и синхронизация не будут ломаться при добавлении новых экранов.
   --------------------------------------------------------------- */

/** Момент времени в ISO-8601 с зоной, например 2026-08-24T21:14:00.000Z */
export type ISODateTime = string;
/** Календарная дата без времени, например 2026-08-24 */
export type ISODate = string;

/** Поля, которые есть у каждой синхронизируемой записи. */
export interface SyncFields {
  id: string;
  /** Время последнего изменения по часам клиента — арбитр конфликтов. */
  updated_at: ISODateTime;
  /** Мягкое удаление: запись остаётся «надгробием», чтобы удаление доехало на другие устройства. */
  deleted: boolean;
}

/** Локальная обёртка: `_dirty = 1` значит «есть несинхронизированные изменения». */
export type Local<T> = T & { _dirty: 0 | 1 };

export type Sex = "male" | "female";

export interface Child extends SyncFields {
  /** Заполняется при первом входе в аккаунт; до этого запись живёт только локально. */
  family_id: string | null;
  name: string;
  birth_date: ISODate;
  /** Время рождения, если известно — уточняет возраст в первые дни. */
  birth_time: string | null; // "14:35"
  sex: Sex | null;
  birth_weight_g: number | null;
  birth_height_mm: number | null;
}

export type SleepKind = "night" | "nap";

export interface SleepSession extends SyncFields {
  child_id: string;
  start_at: ISODateTime;
  /** null — сон идёт прямо сейчас. */
  end_at: ISODateTime | null;
  kind: SleepKind;
  note: string | null;
}

export interface Measurement extends SyncFields {
  child_id: string;
  measured_at: ISODateTime;
  /** Храним в целых граммах и миллиметрах — никаких дробей и ошибок округления. */
  weight_g: number | null;
  height_mm: number | null;
  head_mm: number | null;
  note: string | null;
}

export type MilestoneKind =
  | "first_smile"
  | "first_tooth"
  | "rolled_over"
  | "sat_up"
  | "crawled"
  | "first_step"
  | "first_word"
  | "custom";

export interface Milestone extends SyncFields {
  child_id: string;
  happened_on: ISODate;
  kind: MilestoneKind;
  title: string;
  note: string | null;
}

export type FeedingKind = "breast_left" | "breast_right" | "bottle" | "solid";

export interface Feeding extends SyncFields {
  child_id: string;
  start_at: ISODateTime;
  end_at: ISODateTime | null;
  kind: FeedingKind;
  amount_ml: number | null;
  food: string | null;
  note: string | null;
}

export type DiaperKind = "wet" | "dirty" | "mixed";

export interface Diaper extends SyncFields {
  child_id: string;
  happened_at: ISODateTime;
  kind: DiaperKind;
  note: string | null;
}

/** Соответствие «имя таблицы → тип записи». Один источник правды для БД и синхронизации. */
export interface TableMap {
  children: Child;
  sleep_sessions: SleepSession;
  measurements: Measurement;
  milestones: Milestone;
  feedings: Feeding;
  diapers: Diaper;
}

export type TableName = keyof TableMap;

/** Порядок важен: дети выгружаются первыми, на них ссылаются остальные таблицы. */
export const TABLES: TableName[] = [
  "children",
  "sleep_sessions",
  "measurements",
  "milestones",
  "feedings",
  "diapers",
];

/** Настройки приложения — только локальные, между устройствами не синхронизируются. */
export interface Settings {
  activeChildId: string | null;
  theme: "dark" | "light" | "system";
  /** Целевое время отхода ко сну, "20:30". null — напоминание выключено. */
  bedtime: string | null;
  /** За сколько минут до отхода ко сну предупредить. */
  bedtimeWarnMinutes: number;
  /** Пользователь сознательно отказался от входа и работает только на этом устройстве. */
  localOnly: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  activeChildId: null,
  theme: "dark",
  bedtime: "20:30",
  bedtimeWarnMinutes: 30,
  localOnly: false,
};
