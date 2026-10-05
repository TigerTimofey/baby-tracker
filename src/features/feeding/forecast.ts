import type { Feeding } from "../../data/types";
import { median } from "../stats/statsUtils";
import { sortedByStartDesc, startMs } from "./feedingUtils";

const HISTORY_DAYS = 14;
const MAX_SAMPLES = 10;
const MIN_SAMPLES = 3;

/**
 * Промежуток длиннее двенадцати часов — почти наверняка пропущенная запись,
 * а не настоящий перерыв между кормлениями. В медиану он не идёт.
 */
const MAX_GAP_MS = 12 * 3600_000;

export interface FeedingForecast {
  /** Когда, по оценке, начнётся следующее кормление. */
  at: number;
  /** Сколько промежутков легло в расчёт. */
  samples: number;
}

/**
 * Промежутки между началами соседних кормлений за последние две недели, от
 * старых к новым. Меряется от начала до начала — так и говорят «кормим каждые
 * три часа», а не «через два с половиной после того, как доел».
 *
 * Вид кормления не важен: грудь, бутылочка и прикорм идут в одну цепочку.
 * Прогноз отвечает на вопрос «когда снова есть», а не «когда снова грудь».
 */
export function feedingGaps(feedings: Feeding[], now: number): number[] {
  const since = now - HISTORY_DAYS * 24 * 3600_000;
  const starts = feedings
    .map(startMs)
    .filter((start) => start >= since && start <= now)
    .sort((a, b) => a - b);

  const gaps: number[] = [];
  for (let index = 1; index < starts.length; index += 1) {
    const gap = starts[index] - starts[index - 1];
    if (gap > 0 && gap <= MAX_GAP_MS) gaps.push(gap);
  }
  return gaps;
}

/**
 * Прогноз следующего кормления — устроен как прогноз сна: медиана последних
 * десяти промежутков, отсчёт от начала последнего кормления.
 *
 * Возрастного ориентира, в отличие от сна, нет. Интервал между кормлениями
 * слишком зависит от того, грудь это или бутылочка, и общая цифра по возрасту
 * была бы выдумкой. Пока своих промежутков меньше трёх, прогноза нет вовсе —
 * на одних сутках записей он уже появляется.
 */
export function forecastNextFeeding(
  feedings: Feeding[],
  now: number,
): FeedingForecast | null {
  const latest = sortedByStartDesc(feedings)[0];
  if (!latest) return null;

  const gaps = feedingGaps(feedings, now).slice(-MAX_SAMPLES);
  if (gaps.length < MIN_SAMPLES) return null;

  return { at: startMs(latest) + median(gaps), samples: gaps.length };
}
