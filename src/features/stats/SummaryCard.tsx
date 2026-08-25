import { useRef, useState } from "react";
import { Button } from "../../components/ui/Button";
import { Icon } from "../../components/ui/Icon";
import { showToast } from "../../components/ui/toast";
import type { SummaryData, SummaryLine } from "./summaryData";
import styles from "./SummaryCard.module.css";

const W = 1080;
const PAD = 88;
const FONT =
  "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

const BG = "#12121b";
const GOLD = "#fed12a";
const TEXT = "#ecebf5";
const MUTED = "#9b98b2";
const FAINT = "#6a6782";
const LINE = "#2e2e46";

interface Block {
  title: string;
  lines: SummaryLine[];
}

export function SummaryCard({ data }: { data: SummaryData }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [busy, setBusy] = useState(false);

  const blocks: Block[] = [
    { title: "СОН", lines: data.sleep },
    { title: "КОРМЛЕНИЯ", lines: data.feeding },
    { title: "РОСТ И ВЕС", lines: data.growth },
  ].filter((block) => block.lines.length > 0);

  const nodes: React.ReactNode[] = [];
  let y = 118;

  nodes.push(
    <text key="brand" x={PAD} y={y} fill={FAINT} fontSize={26} letterSpacing={6} fontFamily={FONT}>
      SEBASON
    </text>,
    <text key="date" x={W - PAD} y={y} fill={FAINT} fontSize={26} textAnchor="end" fontFamily={FONT}>
      {data.madeOn}
    </text>,
  );

  y += 108;
  nodes.push(
    <text key="name" x={PAD} y={y} fill={TEXT} fontSize={76} fontWeight={700} fontFamily={FONT}>
      {data.childName}
    </text>,
  );

  y += 52;
  nodes.push(
    <text key="age" x={PAD} y={y} fill={MUTED} fontSize={34} fontFamily={FONT}>
      {data.age} · {data.periodLabel}
    </text>,
  );

  y += 176;
  nodes.push(
    <text key="head" x={PAD} y={y} fill={GOLD} fontSize={128} fontWeight={700} fontFamily={FONT}>
      {data.headline}
    </text>,
  );

  y += 52;
  nodes.push(
    <text key="headhint" x={PAD} y={y} fill={MUTED} fontSize={34} fontFamily={FONT}>
      {data.headlineHint}
    </text>,
  );

  for (const block of blocks) {
    y += 92;
    nodes.push(
      <line key={`l-${block.title}`} x1={PAD} x2={W - PAD} y1={y} y2={y} stroke={LINE} strokeWidth={2} />,
    );
    y += 52;
    nodes.push(
      <text key={`t-${block.title}`} x={PAD} y={y} fill={FAINT} fontSize={24} letterSpacing={4} fontFamily={FONT}>
        {block.title}
      </text>,
    );

    for (const line of block.lines) {
      y += 62;
      nodes.push(
        <text key={`k-${block.title}-${line.label}`} x={PAD} y={y} fill={MUTED} fontSize={32} fontFamily={FONT}>
          {line.label}
        </text>,
        <text
          key={`v-${block.title}-${line.label}`}
          x={W - PAD}
          y={y}
          fill={TEXT}
          fontSize={36}
          fontWeight={650}
          textAnchor="end"
          fontFamily={FONT}
        >
          {line.value}
        </text>,
      );
      if (line.hint) {
        y += 34;
        nodes.push(
          <text key={`h-${block.title}-${line.label}`} x={PAD} y={y} fill={FAINT} fontSize={26} fontFamily={FONT}>
            {line.hint}
          </text>,
        );
      }
    }
  }

  const height = y + PAD;

  async function toPng() {
    const svg = svgRef.current;
    if (!svg) return;

    setBusy(true);
    try {
      const xml = new XMLSerializer().serializeToString(svg);
      const blob = new Blob([xml], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);

      const image = new Image();
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("не удалось нарисовать"));
        image.src = url;
      });

      const canvas = document.createElement("canvas");
      canvas.width = W;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("нет холста");
      context.fillStyle = BG;
      context.fillRect(0, 0, W, height);
      context.drawImage(image, 0, 0, W, height);
      URL.revokeObjectURL(url);

      const png = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/png"),
      );
      if (!png) throw new Error("не удалось сохранить");

      const name = `sebason-${data.childName.toLowerCase()}-${new Date()
        .toISOString()
        .slice(0, 10)}.png`;
      const file = new File([png], name, { type: "image/png" });

      const onPhone = navigator.maxTouchPoints > 0;
      if (onPhone && navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: "Sebason" });
          return;
        } catch (cause) {
          if ((cause as Error)?.name === "AbortError") return;
        }
      }

      const link = document.createElement("a");
      link.href = URL.createObjectURL(png);
      link.download = name;
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(link.href);
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
          aria-label={`Итоги ${data.periodLabel}`}
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
        «Картинкой» сохранит PNG или предложит отправить его сразу. «В PDF»
        откроет печать — в диалоге выберите «Сохранить как PDF».
      </p>
    </div>
  );
}
