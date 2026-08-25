import styles from "./Donut.module.css";

export interface DonutSlice {
  label: string;
  value: number;
  color: string;
}

interface DonutProps {
  slices: DonutSlice[];
  size?: number;
  thickness?: number;
  center?: string;
  centerHint?: string;
  ariaLabel: string;
}

const RADIUS = 50;

export function Donut({
  slices,
  size = 120,
  thickness = 15,
  center,
  centerHint,
  ariaLabel,
}: DonutProps) {
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);
  if (total <= 0) return null;

  const circumference = 2 * Math.PI * RADIUS;
  let offset = 0;

  return (
    <div className={styles.wrap} style={{ width: size, height: size }}>
      <svg
        viewBox={`0 0 ${RADIUS * 2 + thickness} ${RADIUS * 2 + thickness}`}
        width={size}
        height={size}
        role="img"
        aria-label={ariaLabel}
      >
        <g transform={`rotate(-90 ${RADIUS + thickness / 2} ${RADIUS + thickness / 2})`}>
          {slices.map((slice) => {
            const length = (slice.value / total) * circumference;
            const dash = `${length} ${circumference - length}`;
            const element = (
              <circle
                key={slice.label}
                cx={RADIUS + thickness / 2}
                cy={RADIUS + thickness / 2}
                r={RADIUS}
                fill="none"
                stroke={slice.color}
                strokeWidth={thickness}
                strokeDasharray={dash}
                strokeDashoffset={-offset}
              />
            );
            offset += length;
            return element;
          })}
        </g>
      </svg>

      {center && (
        <div className={styles.center}>
          <span className={`${styles.centerValue} tnum`}>{center}</span>
          {centerHint && <span className={styles.centerHint}>{centerHint}</span>}
        </div>
      )}
    </div>
  );
}
