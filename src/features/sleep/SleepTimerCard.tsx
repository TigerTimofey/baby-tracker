import { useState, type ReactNode } from "react";
import { Button } from "../../components/ui/Button";
import { Icon } from "../../components/ui/Icon";
import { Segmented } from "../../components/ui/Segmented";
import { useAuthorLabel, useNow, useSettings } from "../../data/hooks";
import { newId, nowISO, save } from "../../data/repo";
import type { Child, SleepKind, SleepSession } from "../../data/types";
import {
  ageOf,
  birthMoment,
  formatClock,
  formatDuration,
  formatTime,
  parseTimeOfDay,
} from "../../lib/time";
import { SleepEditor } from "./SleepEditor";
import {
  bandFor,
  findActive,
  guessKind,
  kindLabel,
  lastWakeMs,
  startMs,
} from "./sleepUtils";
import styles from "./SleepTimerCard.module.css";

interface SleepTimerCardProps {
  child: Child;
  sessions: SleepSession[];
  action?: ReactNode;
}

function msUntilBedtime(bedtime: string | null, now: number): number | null {
  if (!bedtime) return null;
  const minutes = parseTimeOfDay(bedtime);
  if (minutes === null) return null;

  const target = new Date(now);
  target.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return target.getTime() - now;
}

export function SleepTimerCard({
  child,
  sessions,
  action,
}: SleepTimerCardProps) {
  const now = useNow(1000);
  const settings = useSettings();
  const author = useAuthorLabel();
  const [editorOpen, setEditorOpen] = useState(false);

  const active = findActive(sessions);
  const activeAuthor = active ? author(active.created_by) : null;
  const age = ageOf(birthMoment(child.birth_date, child.birth_time), new Date(now));
  const band = bandFor(age.totalMonths);

  async function startSleep() {
    const at = new Date();
    const record: SleepSession = {
      id: newId(),
      child_id: child.id,
      start_at: at.toISOString(),
      end_at: null,
      kind: guessKind(at),
      note: null,
      updated_at: nowISO(),
      deleted: false,
      created_by: null,
    };
    await save("sleep_sessions", record);
  }

  async function stopSleep() {
    if (!active) return;
    await save("sleep_sessions", { ...active, end_at: new Date().toISOString() });
  }

  async function changeKind(kind: SleepKind) {
    if (!active) return;
    await save("sleep_sessions", { ...active, kind });
  }

  if (active) {
    const elapsed = now - startMs(active);

    return (
      <>
        <div className={`${styles.card} ${styles.sleeping}`}>
          <span className={styles.status}>
            <Icon name="moon" size={14} />
            {kindLabel(active.kind)}
          </span>

          <div className={`${styles.big} tnum`}>{formatClock(elapsed)}</div>
          <p className={styles.sub}>
            уснул в {formatTime(active.start_at)}
            {activeAuthor ? ` · ${activeAuthor}` : ""}
          </p>

          <div className={styles.actions}>
            <Button size="lg" variant="primary" onClick={stopSleep}>
              <Icon name="stop" size={18} />
              Проснулся
            </Button>
            {action}
          </div>

          <div style={{ maxWidth: 260, margin: "var(--gap-4) auto 0" }}>
            <Segmented<SleepKind>
              value={active.kind}
              onChange={changeKind}
              ariaLabel="Тип сна"
              options={[
                { value: "nap", label: "Дневной" },
                { value: "night", label: "Ночной" },
              ]}
            />
          </div>

          <button
            type="button"
            className={styles.editLink}
            onClick={() => setEditorOpen(true)}
          >
            поправить время
          </button>
        </div>

        {editorOpen && (
          <SleepEditor
            open={editorOpen}
            onClose={() => setEditorOpen(false)}
            childId={child.id}
            session={active}
          />
        )}
      </>
    );
  }

  const wakeAt = lastWakeMs(sessions);
  const awakeMs = wakeAt === null ? null : Math.max(0, now - wakeAt);
  const windowMs = band.wakeMax * 60_000;
  const progress =
    awakeMs === null ? 0 : Math.min(1, awakeMs / windowMs);
  const overdue = awakeMs !== null && awakeMs > windowMs;

  const untilBedtime = msUntilBedtime(settings.bedtime, now);
  const bedtimeSoon =
    untilBedtime !== null && untilBedtime > 0 && untilBedtime <= settings.bedtimeWarnMinutes * 60_000;
  const bedtimePassed = untilBedtime !== null && untilBedtime <= 0;

  return (
    <>
      <div className={styles.card}>
        <span className={styles.status}>
          <Icon name="sun" size={14} />
          Бодрствует
        </span>

        {awakeMs === null ? (
          <p className={styles.lead}>
            Нажмите «Уснул», когда малыш заснёт — дальше приложение посчитает
            само.
          </p>
        ) : (
          <>
            <div className={`${styles.big} tnum`}>
              {awakeMs < 60_000 ? "только что" : formatDuration(awakeMs)}
            </div>
            <p className={styles.sub}>
              проснулся в {formatTime(new Date(wakeAt as number))}
            </p>
          </>
        )}

        {awakeMs !== null && (
          <>
            <div className={styles.bar}>
              <div
                className={`${styles.barFill} ${overdue ? styles.barOver : ""}`}
                style={{ width: `${Math.round(progress * 100)}%` }}
              />
            </div>
            <p className={`${styles.hint} ${overdue ? styles.hintWarn : ""}`}>
              {overdue
                ? "бодрствует дольше обычного для этого возраста"
                : `в ${age.totalMonths} мес обычно бодрствуют ${
                    band.wakeMin >= 60
                      ? `${(band.wakeMin / 60).toLocaleString("ru-RU")}–${(band.wakeMax / 60).toLocaleString("ru-RU")} ч`
                      : `${band.wakeMin}–${band.wakeMax} мин`
                  }`}
            </p>
          </>
        )}

        <div className={styles.actions}>
          <Button size="lg" variant="primary" onClick={startSleep}>
            <Icon name="moon" size={18} />
            Уснул
          </Button>
          {action}
        </div>

        {(bedtimeSoon || bedtimePassed) && (
          <p className={`${styles.hint} ${styles.hintWarn}`}>
            {bedtimePassed
              ? `время сна было в ${settings.bedtime}`
              : `до сна ${formatDuration(untilBedtime ?? 0)}`}
          </p>
        )}
        {!bedtimeSoon && !bedtimePassed && untilBedtime !== null && untilBedtime > 0 && (
          <p className={styles.hint}>
            отход ко сну в {settings.bedtime} — через {formatDuration(untilBedtime)}
          </p>
        )}
      </div>
    </>
  );
}
