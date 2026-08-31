import { locale, pluralOf, t } from "../../lib/i18n";
import { differenceInCalendarDays } from "date-fns";
import type { Child, Measurement } from "../../data/types";

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
  const reference = t("ориентир для {0} мес — {1}–{2} ч в сутки", [ageMonths, band.sleepMinH, band.sleepMaxH]);

  if (stats.avgTotalMs === null || stats.daysCounted < MIN_DAYS_FOR_SLEEP) {
    return {
      label: t("Сон"),
      value: t("нет данных"),
      detail: t("нужно хотя бы {0} полных дня с записями", [MIN_DAYS_FOR_SLEEP]),
      status: "unknown",
    };
  }

  const hours = stats.avgTotalMs / HOUR_MS;
  const inside = hours >= band.sleepMinH && hours <= band.sleepMaxH;

  return {
    label: t("Сон"),
    value: t("{0} ч в сутки", [hours.toLocaleString(locale(), { maximumFractionDigits: 1 })]),
    detail: t("{0} · в среднем по {1} {2}", [reference, stats.daysCounted, pluralOf(stats.daysCounted, "дню")]),
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
        value: t("нет измерений"),
        detail: t("добавьте замер на вкладке «ВОЗ»"),
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
            ? t("в профиле не указан пол — таблицы ВОЗ для мальчиков и девочек разные")
            : t("возраст вне таблиц ВОЗ — сравнить не с чем"),
        status: "unknown",
      });
      continue;
    }

    const days = differenceInCalendarDays(new Date(now), last.at);
    const age =
      days <= 0
        ? t("замер сегодня")
        : t("замер {0} {1} назад", [days, pluralOf(days, "день")]);

    rows.push({
      label: info.label,
      value: `${info.format(last.raw)} · ${percentileLabel(percentileFromZ(z))}`,
      detail:
        Math.abs(z) <= WHO_LIMIT_Z
          ? t("внутри коридора ВОЗ (с 3-го по 97-й перцентиль) · {0}", [age])
          : t("за пределами коридора ВОЗ (с 3-го по 97-й перцентиль) · {0}", [age]),
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
      headline: t("Не всё в ориентирах"),
      sub: t("вне ориентиров: {0}", [names]),
      rows,
    };
  }

  if (ok.length === 0) {
    return {
      status: "unknown",
      headline: t("Данных пока мало"),
      sub: t("нужны замеры роста и веса и хотя бы несколько дней записей сна"),
      rows,
    };
  }

  return {
    status: "ok",
    headline: t("Всё в ориентирах"),
    sub:
      unknown.length === 0
        ? t("{0} из {1} {2} проверено", [ok.length, rows.length, pluralOf(rows.length, "показателя")])
        : t("{0} из {1} в норме · по остальным нет данных", [ok.length, rows.length]),
    rows,
  };
}
