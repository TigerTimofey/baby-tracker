import { locale, t } from "../../lib/i18n";
import type { Sex } from "../../data/types";
import { useSvgTextScale } from "../../lib/useSvgTextScale";
import { METRICS, type Point } from "./growthUtils";
import type { WhoMetric } from "./whoData";
import { WHO_MAX_AGE_DAYS } from "./whoData";
import { valueAtZ } from "./whoUtils";
import styles from "./GrowthChart.module.css";

const W = 340;
const AXIS_PX = 9;
const H = 208;
const PAD_LEFT = 30;
const PAD_RIGHT = 6;
const PAD_TOP = 10;
const PAD_BOTTOM = 20;
const SAMPLES = 60;
const DAYS_PER_MONTH = 30.4375;

const Z_P3 = -1.8808;
const Z_P15 = -1.0364;
const Z_P85 = 1.0364;
const Z_P97 = 1.8808;

interface GrowthChartProps {
  metric: WhoMetric;
  sex: Sex | null;
  points: Point[];
  ageDaysNow: number;
}

function niceStep(range: number, count: number): number {
  const rough = range / count;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rough)));
  for (const factor of [1, 2, 2.5, 5, 10]) {
    if (magnitude * factor >= rough) return magnitude * factor;
  }
  return magnitude * 10;
}

export function GrowthChart({ metric, sex, points, ageDaysNow }: GrowthChartProps) {
  const [wrapRef, scale] = useSvgTextScale(W);

  const info = METRICS[metric];

  const lastAge = points.length ? points[points.length - 1].ageDays : 0;
  const rawMaxAge = Math.max(30, ageDaysNow + 7, lastAge + 7);
  const maxMonths = Math.max(1, Math.ceil(rawMaxAge / DAYS_PER_MONTH));
  const maxAge = Math.min(WHO_MAX_AGE_DAYS, maxMonths * DAYS_PER_MONTH);

  const sampleDays = Array.from(
    { length: SAMPLES + 1 },
    (_, index) => (maxAge * index) / SAMPLES,
  );

  const curve = (z: number): number[] | null => {
    if (!sex) return null;
    const values = sampleDays.map((day) => valueAtZ(metric, sex, day, z));
    return values.every((value): value is number => value !== null)
      ? values
      : null;
  };

  const p3 = curve(Z_P3);
  const p15 = curve(Z_P15);
  const p50 = curve(0);
  const p85 = curve(Z_P85);
  const p97 = curve(Z_P97);
  const hasBands = Boolean(p3 && p15 && p50 && p85 && p97);

  const measured = points.map((point) => point.who);
  const candidates = [
    ...measured,
    ...(hasBands ? [...(p3 as number[]), ...(p97 as number[])] : []),
  ];
  if (candidates.length === 0) return null;

  let yMin = Math.min(...candidates);
  let yMax = Math.max(...candidates);
  if (yMax - yMin < 0.001) {
    yMin -= 1;
    yMax += 1;
  }
  const pad = (yMax - yMin) * 0.06;
  yMin -= pad;
  yMax += pad;

  const plotW = W - PAD_LEFT - PAD_RIGHT;
  const plotH = H - PAD_TOP - PAD_BOTTOM;
  const x = (day: number) => PAD_LEFT + (day / maxAge) * plotW;
  const y = (value: number) =>
    PAD_TOP + plotH - ((value - yMin) / (yMax - yMin)) * plotH;

  const areaPath = (lower: number[], upper: number[]): string => {
    const down = sampleDays.map((day, i) => `${x(day)},${y(upper[i])}`).join(" L");
    const back = [...sampleDays]
      .map((day, i) => ({ day, value: lower[i] }))
      .reverse()
      .map((item) => `${x(item.day)},${y(item.value)}`)
      .join(" L");
    return `M${down} L${back} Z`;
  };

  const linePath = (values: number[]): string =>
    "M" + sampleDays.map((day, i) => `${x(day)},${y(values[i])}`).join(" L");

  const yStep = niceStep(yMax - yMin, 4);
  const yTicks: number[] = [];
  for (let v = Math.ceil(yMin / yStep) * yStep; v <= yMax; v += yStep) {
    yTicks.push(Number(v.toFixed(6)));
  }

  const monthStep =
    maxMonths <= 6 ? 1 : maxMonths <= 14 ? 2 : maxMonths <= 30 ? 6 : 12;
  const xTicks: number[] = [];
  for (let m = 0; m <= maxMonths; m += monthStep) xTicks.push(m);

  const digits = metric === "weight" ? 1 : 0;

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <svg
        className={styles.svg}
        viewBox={`0 0 ${W} ${H}`}
        style={{ fontSize: AXIS_PX / scale }}
        role="img"
        aria-label={t("График: {0}", [info.short])}
      >
        {yTicks.map((tick) => (
          <g key={`y-${tick}`}>
            <line
              className={styles.grid}
              x1={PAD_LEFT}
              x2={W - PAD_RIGHT}
              y1={y(tick)}
              y2={y(tick)}
            />
            <text
              className={styles.axis}
              x={PAD_LEFT - 4}
              y={y(tick) + 2.5}
              textAnchor="end"
            >
              {tick.toLocaleString(locale(), {
                minimumFractionDigits: digits,
                maximumFractionDigits: digits,
              })}
            </text>
          </g>
        ))}

        {hasBands && (
          <>
            <path
              className={styles.bandOuter}
              d={areaPath(p3 as number[], p97 as number[])}
            />
            <path
              className={styles.bandInner}
              d={areaPath(p15 as number[], p85 as number[])}
            />
            <path className={styles.median} d={linePath(p50 as number[])} />
          </>
        )}

        {points.length > 1 && (
          <path
            className={styles.line}
            d={
              "M" +
              points.map((point) => `${x(point.ageDays)},${y(point.who)}`).join(" L")
            }
          />
        )}

        {points.map((point) => (
          <circle
            key={point.id}
            className={styles.dot}
            cx={x(point.ageDays)}
            cy={y(point.who)}
            r={3}
          />
        ))}

        {xTicks.map((month) => (
          <text
            key={`x-${month}`}
            className={styles.axis}
            x={x(month * DAYS_PER_MONTH)}
            y={H - PAD_BOTTOM + 11}
            textAnchor="middle"
          >
            {month}
          </text>
        ))}

        <text
          className={styles.axis}
          x={W - PAD_RIGHT}
          y={H - 2}
          textAnchor="end"
        >
          {t("возраст, месяцев")}
        </text>
      </svg>

      <div className={styles.legend}>
        <span className={styles.legendItem}>
          <i className={styles.swatchLine} />
          {info.short}
        </span>
        {hasBands && (
          <span className={styles.legendItem}>
            <i className={styles.swatchBand} />
            {t("коридоры ВОЗ: 3–97 и 15–85 перцентиль")}
          </span>
        )}
      </div>

      {!sex && (
        <p className={styles.hint}>
          {t("Укажите пол малыша в профиле — тогда на графике появятся коридоры\n          нормы ВОЗ.")}
        </p>
      )}
    </div>
  );
}
