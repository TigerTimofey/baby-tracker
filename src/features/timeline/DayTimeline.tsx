import { parseISO } from "date-fns";
import { useState } from "react";
import { Icon } from "../../components/ui/Icon";
import { useLive, useNow } from "../../data/hooks";
import { listByChild } from "../../data/repo";
import type { Feeding, SleepSession } from "../../data/types";
import { formatDayLabel, formatDuration, formatTime } from "../../lib/time";
import { kindLabel } from "../feeding/feedingUtils";
import styles from "./DayTimeline.module.css";

const NO_FEEDINGS: Feeding[] = [];
const MIN_MARK_PERCENT = 1.2;
const HOUR_MARKS = [0, 6, 12, 18, 24];

interface Block {
  id: string;
  left: number;
  width: number;
  title: string;
  detail: string;
  nap?: boolean;
}

interface DayTimelineProps {
  childId: string;
  sessions: SleepSession[];
}

function dayBounds(offset: number, now: number): { from: number; to: number } {
  const start = new Date(now);
  start.setDate(start.getDate() - offset);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { from: start.getTime(), to: end.getTime() };
}

export function DayTimeline({ childId, sessions }: DayTimelineProps) {
  const now = useNow(60_000);
  const [offset, setOffset] = useState(0);
  const [picked, setPicked] = useState<Block | null>(null);

  const { data } = useLive(
    async () => await listByChild("feedings", childId),
    [childId],
  );
  const feedings = data ?? NO_FEEDINGS;

  const { from, to } = dayBounds(offset, now);
  const span = to - from;
  const percent = (value: number) => ((value - from) / span) * 100;

  const clamp = (start: number, end: number) => ({
    left: Math.max(0, percent(start)),
    right: Math.min(100, percent(end)),
  });

  const sleepBlocks: Block[] = sessions.flatMap((session) => {
    const start = parseISO(session.start_at).getTime();
    const end = session.end_at ? parseISO(session.end_at).getTime() : now;
    if (end <= from || start >= to) return [];

    const { left, right } = clamp(start, end);
    return [
      {
        id: session.id,
        left,
        width: Math.max(MIN_MARK_PERCENT, right - left),
        nap: session.kind === "nap",
        title: session.kind === "night" ? "Ночной сон" : "Дневной сон",
        detail: `${formatTime(new Date(start))} → ${
          session.end_at ? formatTime(new Date(end)) : "сейчас"
        } · ${formatDuration(end - start)}`,
      },
    ];
  });

  const feedBlocks: Block[] = feedings.flatMap((feeding) => {
    const start = parseISO(feeding.start_at).getTime();
    const end = feeding.end_at ? parseISO(feeding.end_at).getTime() : now;
    if (end <= from || start >= to) return [];

    const { left, right } = clamp(start, end);
    return [
      {
        id: feeding.id,
        left,
        width: Math.max(MIN_MARK_PERCENT, right - left),
        title: kindLabel(feeding.kind),
        detail: `${formatTime(new Date(start))} · ${
          feeding.end_at ? formatDuration(end - start) : "идёт"
        }${feeding.amount_ml ? ` · ${feeding.amount_ml} мл` : ""}`,
      },
    ];
  });

  const nowPercent = now >= from && now < to ? percent(now) : null;
  const empty = sleepBlocks.length === 0 && feedBlocks.length === 0;

  const renderBlock = (block: Block, feed: boolean) => (
    <button
      key={block.id}
      type="button"
      className={[
        styles.block,
        feed ? styles.blockFeed : block.nap ? styles.blockNap : "",
        picked?.id === block.id ? styles.selected : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={{ left: `${block.left}%`, width: `${block.width}%` }}
      aria-label={`${block.title}, ${block.detail}`}
      onClick={() => setPicked(picked?.id === block.id ? null : block)}
    />
  );

  return (
    <div>
      <div className={styles.header}>
        <button
          type="button"
          className={styles.nav}
          onClick={() => setOffset(offset + 1)}
          aria-label="Предыдущий день"
        >
          <Icon name="chevron-left" size={18} />
        </button>
        <span className={styles.day}>
          {formatDayLabel(new Date(from))}
        </span>
        <button
          type="button"
          className={styles.nav}
          disabled={offset === 0}
          onClick={() => setOffset(Math.max(0, offset - 1))}
          aria-label="Следующий день"
        >
          <Icon name="chevron-right" size={18} />
        </button>
      </div>

      {empty ? (
        <p className={styles.empty}>В этот день записей нет.</p>
      ) : (
        <>
          <p className={styles.readout}>
            {picked ? (
              <>
                <span className={styles.readoutStrong}>{picked.title}</span>
                <br />
                {picked.detail}
              </>
            ) : (
              "Нажмите на отрезок, чтобы увидеть время"
            )}
          </p>

          <div className={styles.track}>
            {sleepBlocks.map((block) => renderBlock(block, false))}
            {nowPercent !== null && (
              <span className={styles.now} style={{ left: `${nowPercent}%` }} />
            )}
          </div>

          <div className={`${styles.track} ${styles.feeds}`}>
            {feedBlocks.map((block) => renderBlock(block, true))}
          </div>

          <div className={styles.hours}>
            {HOUR_MARKS.map((hour) => (
              <span
                key={hour}
                className={styles.hour}
                style={{ left: `${(hour / 24) * 100}%` }}
              >
                {String(hour % 24).padStart(2, "0")}
              </span>
            ))}
          </div>

          <div className={styles.legend}>
            <span className={styles.legendItem}>
              <i className={`${styles.swatch} ${styles.swatchNight}`} />
              ночной сон
            </span>
            <span className={styles.legendItem}>
              <i className={`${styles.swatch} ${styles.swatchNap}`} />
              дневной
            </span>
            <span className={styles.legendItem}>
              <i className={`${styles.swatch} ${styles.swatchFeed}`} />
              кормление
            </span>
          </div>
        </>
      )}
    </div>
  );
}
