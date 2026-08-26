import { differenceInCalendarDays } from "date-fns";
import type { Child, Measurement } from "../../data/types";
import { plural } from "../../lib/time";
import { METRICS, METRIC_ORDER, seriesFor } from "../growth/growthUtils";
import {
  percentileLabel,
  percentileFromZ,
  zScoreFor,
} from "../growth/whoUtils";
import { bandFor } from "../sleep/sleepUtils";
import { HOUR_MS, type SleepStats } from "./statsUtils";

const WHO_LIMIT_Z = 2;
const MIN_DAYS_FOR_SLEEP = 3;

export type CheckStatus = "ok" | "attention" | "unknown";

export interface CheckRow {
  label: string;
  value: string;
  detail: string;
  status: CheckStatus;
}

export interface Checkup {
  status: CheckStatus;
  headline: string;
  sub: string;
  rows: CheckRow[];
}

function sleepRow(stats: SleepStats, ageMonths: number): CheckRow {
  const band = bandFor(ageMonths);
  const reference = `ориентир для ${ageMonths} мес — ${band.sleepMinH}–${band.sleepMaxH} ч в сутки`;

  if (stats.avgTotalMs === null || stats.daysCounted < MIN_DAYS_FOR_SLEEP) {
    return {
      label: "Сон",
      value: "нет данных",
      detail: `нужно хотя бы ${MIN_DAYS_FOR_SLEEP} полных дня с записями`,
      status: "unknown",
    };
  }

  const hours = stats.avgTotalMs / HOUR_MS;
  const inside = hours >= band.sleepMinH && hours <= band.sleepMaxH;

  return {
    label: "Сон",
    value: `${hours.toLocaleString("ru-RU", { maximumFractionDigits: 1 })} ч в сутки`,
    detail: `${reference} · в среднем по ${stats.daysCounted} ${plural(
      stats.daysCounted,
      ["дню", "дням", "дням"],
    )}`,
    status: inside ? "ok" : "attention",
  };
}

export function buildCheckup(
  child: Child,
  measurements: Measurement[],
  stats: SleepStats,
  ageMonths: number,
  now: number,
): Checkup {
  const rows: CheckRow[] = [];

  for (const key of METRIC_ORDER) {
    const info = METRICS[key];
    const points = seriesFor(key, child, measurements);
    const last = points[points.length - 1];

    if (!last) {
      rows.push({
        label: info.label,
        value: "нет измерений",
        detail: "добавьте замер на вкладке «ВОЗ»",
        status: "unknown",
      });
      continue;
    }

    const z =
      child.sex === null
        ? null
        : zScoreFor(key, child.sex, last.ageDays, last.who);
    if (z === null) {
      rows.push({
        label: info.label,
        value: info.format(last.raw),
        detail:
          child.sex === null
            ? "в профиле не указан пол — таблицы ВОЗ для мальчиков и девочек разные"
            : "возраст вне таблиц ВОЗ — сравнить не с чем",
        status: "unknown",
      });
      continue;
    }

    const days = differenceInCalendarDays(new Date(now), last.at);
    const age =
      days <= 0
        ? "замер сегодня"
        : `замер ${days} ${plural(days, ["день", "дня", "дней"])} назад`;

    rows.push({
      label: info.label,
      value: `${info.format(last.raw)} · ${percentileLabel(percentileFromZ(z))}`,
      detail:
        Math.abs(z) <= WHO_LIMIT_Z
          ? `внутри коридора ВОЗ (с 3-го по 97-й перцентиль) · ${age}`
          : `за пределами коридора ВОЗ (с 3-го по 97-й перцентиль) · ${age}`,
      status: Math.abs(z) <= WHO_LIMIT_Z ? "ok" : "attention",
    });
  }

  rows.push(sleepRow(stats, ageMonths));

  const attention = rows.filter((row) => row.status === "attention");
  const ok = rows.filter((row) => row.status === "ok");
  const unknown = rows.filter((row) => row.status === "unknown");

  if (attention.length > 0) {
    const names = attention.map((row) => row.label.toLowerCase()).join(", ");
    return {
      status: "attention",
      headline: "Не всё в ориентирах",
      sub: `вне ориентиров: ${names}`,
      rows,
    };
  }

  if (ok.length === 0) {
    return {
      status: "unknown",
      headline: "Данных пока мало",
      sub: "нужны замеры роста и веса и хотя бы несколько дней записей сна",
      rows,
    };
  }

  return {
    status: "ok",
    headline: "Всё в ориентирах",
    sub:
      unknown.length === 0
        ? `${ok.length} из ${rows.length} ${plural(rows.length, ["показателя", "показателей", "показателей"])} проверено`
        : `${ok.length} из ${rows.length} в норме · по остальным нет данных`,
    rows,
  };
}
