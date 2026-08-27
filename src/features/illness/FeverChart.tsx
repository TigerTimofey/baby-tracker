import type { Medicine, Temperature } from "../../data/types";
import { useSvgTextScale } from "../../lib/useSvgTextScale";
import { buildFeverModel } from "./feverModel";
import { levelOf, measuredMs, methodLabel } from "./tempUtils";
import styles from "./FeverChart.module.css";

const W = 340;
const H = 158;
const PAD_LEFT = 28;
const PAD_RIGHT = 6;
const PAD_TOP = 10;
const PAD_BOTTOM = 44;
const AXIS_PX = 9;

interface FeverChartProps {
  readings: Temperature[];
  doses: Medicine[];
  ageMonths: number;
  now: number;
}

export function FeverChart({
  readings,
  doses,
  ageMonths,
  now,
}: FeverChartProps) {
  const [wrapRef, scale] = useSvgTextScale(W);
  const model = buildFeverModel(readings, doses, ageMonths, now);
  if (!model) return null;

  const plotW = W - PAD_LEFT - PAD_RIGHT;
  const plotH = H - PAD_TOP - PAD_BOTTOM;
  const bottom = PAD_TOP + plotH;
  const x = (at: number) =>
    PAD_LEFT + ((at - model.from) / model.span) * plotW;
  const y = (celsius: number) =>
    PAD_TOP + ((model.top - celsius) / (model.top - model.low)) * plotH;

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <svg
        className={styles.svg}
        viewBox={`0 0 ${W} ${H}`}
        style={{ fontSize: AXIS_PX / scale }}
        role="img"
        aria-label="График температуры"
      >
        {model.degrees.map((tick) => (
          <g key={`t-${tick}`}>
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
              y={y(tick) + 3}
              textAnchor="end"
            >
              {tick.toLocaleString("ru-RU", { minimumFractionDigits: 1 })}
            </text>
          </g>
        ))}

        <line
          className={styles.feverLine}
          x1={PAD_LEFT}
          x2={W - PAD_RIGHT}
          y1={y(model.fever)}
          y2={y(model.fever)}
        />
        <line
          className={styles.highLine}
          x1={PAD_LEFT}
          x2={W - PAD_RIGHT}
          y1={y(model.high)}
          y2={y(model.high)}
        />

        {model.timeTicks.map(({ at, midnight }) => (
          <g key={`x-${at}`}>
            <line
              className={midnight ? styles.midnight : styles.hourLine}
              x1={x(at)}
              x2={x(at)}
              y1={PAD_TOP}
              y2={bottom}
            />
            <text
              className={styles.axis}
              x={x(at)}
              y={bottom + 26}
              textAnchor="middle"
            >
              {String(new Date(at).getHours()).padStart(2, "0")}
            </text>
            {midnight && (
              <text
                className={styles.axis}
                x={x(at)}
                y={bottom + 15}
                textAnchor="middle"
              >
                {new Date(at).toLocaleDateString("ru-RU", {
                  day: "numeric",
                  month: "short",
                })}
              </text>
            )}
          </g>
        ))}

        {model.segments.map((segment, index) => (
          <polyline
            key={`s-${index}`}
            className={styles.line}
            points={segment
              .map((item) => `${x(measuredMs(item))},${y(item.celsius)}`)
              .join(" ")}
          />
        ))}

        {model.points.map((item) => (
          <circle
            key={item.id}
            className={`${styles.dot} ${styles[levelOf(item, ageMonths)]}`}
            cx={x(measuredMs(item))}
            cy={y(item.celsius)}
            r={2.6}
          />
        ))}

        {model.marks.map((at) => (
          <path
            key={`m-${at}`}
            className={styles.dose}
            d={`M${x(at) - 3} ${bottom + 4.5} L${x(at) + 3} ${bottom + 4.5} L${x(at)} ${bottom} Z`}
          />
        ))}
      </svg>

      <div className={styles.legend}>
        <span className={styles.legendItem}>
          <i className={`${styles.swatch} ${styles.swatchFever}`} />
          порог жара
        </span>
        <span className={styles.legendItem}>
          <i className={`${styles.swatch} ${styles.swatchHigh}`} />
          тревожно
        </span>
        {model.marks.length > 0 && (
          <span className={styles.legendItem}>
            <i className={styles.swatchDose} />
            лекарство
          </span>
        )}
      </div>

      <p className={styles.basis}>
        Пунктир — границы для способа «{methodLabel(model.method).toLowerCase()}
        », им мерили чаще всего за этот отрезок. Точки покрашены каждая по
        своему способу. Линия рвётся там, где между замерами прошло больше
        восьми часов: что было в перерыве, приложение не знает.
      </p>
    </div>
  );
}
