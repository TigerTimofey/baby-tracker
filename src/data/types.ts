export type ISODateTime = string;

export type ISODate = string;

export interface SyncFields {
  id: string;
  updated_at: ISODateTime;
  deleted: boolean;
  created_by: string | null;
}

export type Local<T> = T & { _dirty: 0 | 1 };

export type Sex = "male" | "female";

export interface Child extends SyncFields {
  family_id: string | null;
  name: string;
  birth_date: ISODate;
  birth_time: string | null;
  sex: Sex | null;
  birth_weight_g: number | null;
  birth_height_mm: number | null;
}

export type SleepKind = "night" | "nap";

export type NightFeedingKind = "breast" | "bottle" | "solid";

export interface SleepSession extends SyncFields {
  child_id: string;
  start_at: ISODateTime;
  end_at: ISODateTime | null;
  kind: SleepKind;
  ended_by: string | null;
  night_feedings: number | null;
  night_feeding_kind: NightFeedingKind | null;
  night_feeding_ml: number | null;
  note: string | null;
}

export interface Measurement extends SyncFields {
  child_id: string;
  measured_at: ISODateTime;
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
  ended_by: string | null;
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

export interface TableMap {
  children: Child;
  sleep_sessions: SleepSession;
  measurements: Measurement;
  milestones: Milestone;
  feedings: Feeding;
  diapers: Diaper;
}

export type TableName = keyof TableMap;

export const TABLES: TableName[] = [
  "children",
  "sleep_sessions",
  "measurements",
  "milestones",
  "feedings",
  "diapers",
];

export interface Settings {
  activeChildId: string | null;
  theme: "dark" | "light" | "system";
  bedtime: string | null;
  bedtimeWarnMinutes: number;
  localOnly: boolean;
  notifications: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  activeChildId: null,
  theme: "dark",
  bedtime: "20:30",
  bedtimeWarnMinutes: 30,
  localOnly: false,
  notifications: false,
};
