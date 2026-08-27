import { useRef, useState, type ReactNode } from "react";
import { Button } from "../../components/ui/Button";
import { Icon } from "../../components/ui/Icon";
import { showToast } from "../../components/ui/toast";
import type { Child, Medicine, Temperature } from "../../data/types";
import { svgToPng } from "../../lib/exportSvg";
import { formatDayDate, formatTime } from "../../lib/time";
import { doseLine, givenMs } from "./medUtils";
import { buildFeverModel } from "./feverModel";
import {
  formatCelsius,
  levelOf,
  measuredMs,
  methodLabel,
} from "./tempUtils";
import styles from "./IllnessReport.module.css";

const W = 1080;
const PAD = 72;
const FONT =
  "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

const BG = "#12121b";
const TEXT = "#ecebf5";
const MUTED = "#9b98b2";
const FAINT = "#6a6782";
const LINE = "#2e2e46";
const OK = "#36d25f";
const WARN = "#fed12a";
const BAD = "#f2727f";
const DOSE = "#f08bb4";

const LEVEL_COLOR = {
  low: "#63b3ed",
  normal: OK,
  raised: WARN,
  high: BAD,
} as const;

const CHART_H = 420;
const ROW_H = 46;

interface IllnessReportProps {
  child: Child;
  readings: Temperature[];
  doses: Medicine[];
  ageMonths: number;
  age: string;
  now: number;
}

type Entry =
  | { kind: "temp"; at: number; reading: Temperature }
  | { kind: "dose"; at: number; dose: Medicine };

export function IllnessReport({
  child,
  readings,
  doses,
  ageMonths,
  age,
  now,
}: IllnessReportProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [busy, setBusy] = useState(false);

  const entries: Entry[] = [
    ...readings.map((reading): Entry => ({
      kind: "temp",
      at: measuredMs(reading),
      reading,
    })),
    ...doses.map((dose): Entry => ({ kind: "dose", at: givenMs(dose), dose })),
  ].sort((a, b) => b.at - a.at);

  const model = buildFeverModel(readings, doses, ageMonths, now);
  const peak = readings.reduce<Temperature | null>(
    (top, item) => (!top || item.celsius > top.celsius ? item : top),
    null,
  );

  const nodes: ReactNode[] = [];
  let y = PAD + 28;

  nodes.push(
    <text key="brand" x={PAD} y={y} fill={FAINT} fontSize={24} letterSpacing={5} fontFamily={FONT}>
      SEBASON · КОНТРОЛЬ БОЛЕЗНИ
    </text>,
    <text key="made" x={W - PAD} y={y} fill={FAINT} fontSize={24} textAnchor="end" fontFamily={FONT}>
      {formatDayDate(new Date(now))}
    </text>,
  );

  y += 74;
  nodes.push(
    <text key="name" x={PAD} y={y} fill={TEXT} fontSize={64} fontWeight={700} fontFamily={FONT}>
      {child.name}
    </text>,
  );

  y += 42;
  nodes.push(
    <text key="age" x={PAD} y={y} fill={MUTED} fontSize={30} fontFamily={FONT}>
      {age}
    </text>,
  );

  y += 56;
  const facts: [string, string, string][] = [
    ["Замеров", String(readings.length), MUTED],
    [
      "Пик",
      peak ? formatCelsius(peak.celsius) : "—",
      peak ? LEVEL_COLOR[levelOf(peak, ageMonths)] : MUTED,
    ],
    ["Лекарств", String(doses.length), MUTED],
  ];
  facts.forEach(([label, value, color], index) => {
    const left = PAD + index * 300;
    nodes.push(
      <text key={`fl-${label}`} x={left} y={y} fill={FAINT} fontSize={24} fontFamily={FONT}>
        {label}
      </text>,
      <text key={`fv-${label}`} x={left} y={y + 42} fill={color} fontSize={40} fontWeight={650} fontFamily={FONT}>
        {value}
      </text>,
    );
  });
  y += 78;

  if (model) {
    const chartTop = y + 30;
    const plotLeft = PAD + 70;
    const plotRight = W - PAD;
    const plotBottom = chartTop + CHART_H - 86;
    const plotW = plotRight - plotLeft;
    const plotH = plotBottom - chartTop;
    const x = (at: number) =>
      plotLeft + ((at - model.from) / model.span) * plotW;
    const yy = (celsius: number) =>
      chartTop + ((model.top - celsius) / (model.top - model.low)) * plotH;

    for (const tick of model.degrees) {
      nodes.push(
        <line key={`g-${tick}`} x1={plotLeft} x2={plotRight} y1={yy(tick)} y2={yy(tick)} stroke={LINE} strokeWidth={1.5} />,
        <text key={`gt-${tick}`} x={plotLeft - 12} y={yy(tick) + 8} fill={FAINT} fontSize={22} textAnchor="end" fontFamily={FONT}>
          {tick.toLocaleString("ru-RU", { minimumFractionDigits: 1 })}
        </text>,
      );
    }

    nodes.push(
      <line key="fever" x1={plotLeft} x2={plotRight} y1={yy(model.fever)} y2={yy(model.fever)} stroke={WARN} strokeWidth={2.5} strokeDasharray="10 8" />,
      <line key="high" x1={plotLeft} x2={plotRight} y1={yy(model.high)} y2={yy(model.high)} stroke={BAD} strokeWidth={2.5} strokeDasharray="10 8" />,
    );

    for (const { at, midnight } of model.timeTicks) {
      nodes.push(
        <line key={`tt-${at}`} x1={x(at)} x2={x(at)} y1={chartTop} y2={plotBottom} stroke={LINE} strokeWidth={midnight ? 2 : 1} strokeDasharray={midnight ? "6 6" : undefined} />,
        <text key={`th-${at}`} x={x(at)} y={plotBottom + 62} fill={FAINT} fontSize={22} textAnchor="middle" fontFamily={FONT}>
          {String(new Date(at).getHours()).padStart(2, "0")}
        </text>,
      );
      if (midnight) {
        nodes.push(
          <text key={`td-${at}`} x={x(at)} y={plotBottom + 34} fill={MUTED} fontSize={22} textAnchor="middle" fontFamily={FONT}>
            {new Date(at).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}
          </text>,
        );
      }
    }

    model.segments.forEach((segment, index) => {
      nodes.push(
        <polyline
          key={`seg-${index}`}
          fill="none"
          stroke={MUTED}
          strokeWidth={4}
          strokeLinejoin="round"
          strokeLinecap="round"
          points={segment.map((item) => `${x(measuredMs(item))},${yy(item.celsius)}`).join(" ")}
        />,
      );
    });

    for (const item of model.points) {
      nodes.push(
        <circle key={`p-${item.id}`} cx={x(measuredMs(item))} cy={yy(item.celsius)} r={7} fill={LEVEL_COLOR[levelOf(item, ageMonths)]} stroke={BG} strokeWidth={2} />,
      );
    }

    for (const at of model.marks) {
      nodes.push(
        <path key={`dm-${at}`} d={`M${x(at) - 8} ${plotBottom + 14} L${x(at) + 8} ${plotBottom + 14} L${x(at)} ${plotBottom} Z`} fill={DOSE} />,
      );
    }

    y = chartTop + CHART_H;
    // SVG-текст не переносится, поэтому строки нарезаны заранее и коротко:
    // одна длинная фраза просто уехала бы за правый край листа.
    const notes = [
      `Пунктир: жёлтый — порог жара ${formatCelsius(model.fever)}, красный — тревожный ${formatCelsius(model.high)}`,
      `Границы для способа «${methodLabel(model.method).toLowerCase()}», возраст ${age}`,
      "Треугольники — лекарства. Разрыв линии — перерыв больше восьми часов",
    ];
    notes.forEach((note, index) => {
      nodes.push(
        <text key={`note-${index}`} x={PAD} y={y + index * 30} fill={FAINT} fontSize={22} fontFamily={FONT}>
          {note}
        </text>,
      );
    });
    y += notes.length * 30 + 28;
  }

  nodes.push(
    <text key="journal" x={PAD} y={y} fill={FAINT} fontSize={24} letterSpacing={4} fontFamily={FONT}>
      ЖУРНАЛ
    </text>,
  );
  y += 22;

  let lastDay = "";
  for (const entry of entries) {
    const dayKey = new Date(entry.at).toDateString();
    if (dayKey !== lastDay) {
      lastDay = dayKey;
      y += 46;
      nodes.push(
        <text key={`day-${dayKey}`} x={PAD} y={y} fill={TEXT} fontSize={28} fontWeight={650} fontFamily={FONT}>
          {formatDayDate(new Date(entry.at))}
        </text>,
      );
      y += 12;
    }

    y += ROW_H;
    nodes.push(
      <line key={`rl-${entry.at}-${lastDay}`} x1={PAD} x2={W - PAD} y1={y - ROW_H + 12} y2={y - ROW_H + 12} stroke={LINE} strokeWidth={1} />,
      <text key={`rt-${entry.at}`} x={PAD} y={y} fill={MUTED} fontSize={26} fontFamily={FONT}>
        {formatTime(new Date(entry.at))}
      </text>,
    );

    if (entry.kind === "temp") {
      nodes.push(
        <text key={`rm-${entry.reading.id}`} x={PAD + 110} y={y} fill={TEXT} fontSize={26} fontFamily={FONT}>
          {methodLabel(entry.reading.method)}
        </text>,
        <text key={`rv-${entry.reading.id}`} x={W - PAD} y={y} fill={LEVEL_COLOR[levelOf(entry.reading, ageMonths)]} fontSize={28} fontWeight={700} textAnchor="end" fontFamily={FONT}>
          {formatCelsius(entry.reading.celsius)}
        </text>,
      );
    } else {
      nodes.push(
        <text key={`rd-${entry.dose.id}`} x={PAD + 110} y={y} fill={TEXT} fontSize={26} fontFamily={FONT}>
          {doseLine(entry.dose)}
        </text>,
        <text key={`rk-${entry.dose.id}`} x={W - PAD} y={y} fill={DOSE} fontSize={24} textAnchor="end" fontFamily={FONT}>
          лекарство
        </text>,
      );
    }
  }

  y += 64;
  nodes.push(
    <text key="disclaimer" x={PAD} y={y} fill={FAINT} fontSize={22} fontFamily={FONT}>
      Пороги — общепринятые ориентиры, а не диагноз. Выгружено из приложения
      родителем.
    </text>,
  );

  const height = y + PAD;

  async function toPng() {
    const svg = svgRef.current;
    if (!svg) return;
    setBusy(true);
    try {
      await svgToPng(svg, {
        width: W,
        height,
        background: BG,
        filename: `sebason-болезнь-${child.name.toLowerCase()}-${new Date(now)
          .toISOString()
          .slice(0, 10)}.png`,
      });
    } catch {
      showToast("Не удалось сохранить картинку");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className={styles.frame} data-print-root>
        <svg
          ref={svgRef}
          className={styles.svg}
          xmlns="http://www.w3.org/2000/svg"
          viewBox={`0 0 ${W} ${height}`}
          role="img"
          aria-label="Выгрузка по болезни"
        >
          <rect width={W} height={height} fill={BG} />
          {nodes}
        </svg>
      </div>

      <div className={styles.actions}>
        <Button variant="secondary" disabled={busy} onClick={() => void toPng()}>
          <Icon name="stats" size={16} />
          Картинкой
        </Button>
        <Button variant="secondary" onClick={() => window.print()}>
          <Icon name="check" size={16} />
          В PDF
        </Button>
      </div>

      <p className={styles.note}>
        Один лист со всем журналом и графиком — удобно показать врачу.
        «Картинкой» сохранит PNG или предложит отправить его сразу. «В PDF»
        откроет печать: в диалоге выберите «Сохранить как PDF».
      </p>
    </div>
  );
}
