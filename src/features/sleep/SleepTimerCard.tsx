import { locale, t } from "../../lib/i18n";
import { parseISO } from "date-fns";
import { useState, type ReactNode } from "react";
import { Button } from "../../components/ui/Button";
import { Icon } from "../../components/ui/Icon";
import { Segmented } from "../../components/ui/Segmented";
import { useAuthorLabel, useLive, useNow, useSettings } from "../../data/hooks";
import {
  currentAuthor,
  listByChild,
  newId,
  nowISO,
  save,
} from "../../data/repo";
import type { Child, Feeding, SleepKind, SleepSession } from "../../data/types";
import {
  ageOf,
  birthMoment,
  formatClock,
  formatDuration,
  formatTime,
  parseTimeOfDay,
} from "../../lib/time";
import { findActive as findActiveFeeding } from "../feeding/feedingUtils";
import { notificationPermission } from "../../lib/notifications";
import { NightFeedingsSheet } from "../feeding/NightFeedingsSheet";
import { forecastNextSleep } from "./forecast";
import { SleepEditor } from "./SleepEditor";
import {
  bandFor,
  bedtimeOf,
  findActive,
  guessKind,
  kindLabel,
  lastWakeMs,
  startMs,
} from "./sleepUtils";
import styles from "./SleepTimerCard.module.css";

const ASK_ABOUT_FEEDINGS_MS = 2 * 3600_000;
const NO_FEEDINGS: Feeding[] = [];

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
  const [nightSleep, setNightSleep] = useState<SleepSession | null>(null);

  const { data: feedingData } = useLive(
    async () => await listByChild("feedings", child.id),
    [child.id],
  );
  const feedingNow = Boolean(findActiveFeeding(feedingData ?? NO_FEEDINGS));

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
      ended_by: null,
      night_feedings: null,
      no_feed_before: null,
      night_feeding_kind: null,
      night_feeding_ml: null,
      note: null,
      updated_at: nowISO(),
      deleted: false,
      created_by: null,
    };
    await save("sleep_sessions", record);
  }

  async function stopSleep() {
    if (!active) return;

    const finished = await save("sleep_sessions", {
      ...active,
      end_at: new Date().toISOString(),
      ended_by: currentAuthor(),
    });

    const length =
      parseISO(finished.end_at as string).getTime() -
      parseISO(finished.start_at).getTime();

    if (finished.kind === "night" && length > ASK_ABOUT_FEEDINGS_MS) {
      setNightSleep(finished);
    }
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
            {t("уснул в {0}", [formatTime(active.start_at)])}
            {activeAuthor ? ` · ${activeAuthor}` : ""}
          </p>

          <div className={styles.actions}>
            <Button size="lg" variant="primary" onClick={stopSleep}>
              <Icon name="stop" size={18} />
              {t("Проснулся")}
            </Button>
            {action}
          </div>

          <div style={{ maxWidth: 260, margin: "var(--gap-4) auto 0" }}>
            <Segmented<SleepKind>
              value={active.kind}
              onChange={changeKind}
              ariaLabel={t("Тип сна")}
              options={[
                { value: "nap", label: t("Дневной") },
                { value: "night", label: t("Ночной") },
              ]}
            />
          </div>

          <button
            type="button"
            className={styles.editLink}
            onClick={() => setEditorOpen(true)}
          >
            {t("поправить время")}
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
        {nightSleep && (
          <NightFeedingsSheet
            open
            onClose={() => setNightSleep(null)}
            session={nightSleep}
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

  const remindersOn =
    settings.notifications && notificationPermission() === "granted";
  const forecast =
    remindersOn && !feedingNow
      ? forecastNextSleep(sessions, age.totalMonths, now)
      : null;
  const forecastDue = forecast !== null && forecast.at <= now;

  const bedtime = bedtimeOf(child, settings);
  const untilBedtime = msUntilBedtime(bedtime.time, now);
  const bedtimeSoon =
    untilBedtime !== null && untilBedtime > 0 && untilBedtime <= bedtime.warnMinutes * 60_000;
  const bedtimePassed = untilBedtime !== null && untilBedtime <= 0;

  return (
    <>
      <div className={styles.card}>
        <span className={styles.status}>
          <Icon name="sun" size={14} />
          {t("Бодрствует")}
        </span>

        {awakeMs === null ? (
          <p className={styles.lead}>
            {t("Нажмите «Уснул», когда малыш заснёт — дальше приложение посчитает\n            само.")}
          </p>
        ) : (
          <>
            <div className={`${styles.big} tnum`}>
              {awakeMs < 60_000 ? t("только что") : formatDuration(awakeMs)}
            </div>
            <p className={styles.sub}>
              {t("проснулся в {0}", [formatTime(new Date(wakeAt as number))])}
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
            {forecast ? (
              <>
                <p
                  className={`${styles.hint} ${forecastDue ? styles.hintWarn : ""}`}
                >
                  {forecastDue
                    ? t("пора укладывать — обычно уже засыпает")
                    : t("следующий сон примерно в {0} · через {1}", [formatTime(
                        new Date(forecast.at),
                      ), formatDuration(forecast.at - now)])}
                </p>
                <p className={styles.basis}>
                  {forecast.basedOn === "history"
                    ? t("по {0} последним промежуткам между снами", [forecast.samples])
                    : t("по возрастному ориентиру — своих записей пока мало")}
                </p>
              </>
            ) : (
              <p className={`${styles.hint} ${overdue ? styles.hintWarn : ""}`}>
                {overdue
                  ? t("бодрствует дольше обычного для этого возраста")
                  : t("в {0} мес обычно бодрствуют {1}", [
                      age.totalMonths,
                      band.wakeMin >= 60
                        ? t("{0}–{1} ч", [
                            (band.wakeMin / 60).toLocaleString(locale()),
                            (band.wakeMax / 60).toLocaleString(locale()),
                          ])
                        : t("{0}–{1} мин", [band.wakeMin, band.wakeMax]),
                    ])}
              </p>
            )}
          </>
        )}

        <div className={styles.actions}>
          <Button size="lg" variant="primary" onClick={startSleep}>
            <Icon name="moon" size={18} />
            {t("Уснул")}
          </Button>
          {action}
        </div>

        {child.notify_bedtime && (bedtimeSoon || bedtimePassed) && (
          <p className={`${styles.hint} ${styles.hintWarn}`}>
            {bedtimePassed
              ? t("время сна было в {0}", [bedtime.time ?? ""])
              : t("до сна {0}", [formatDuration(untilBedtime ?? 0)])}
          </p>
        )}
        {child.notify_bedtime &&
          !bedtimeSoon &&
          !bedtimePassed &&
          untilBedtime !== null &&
          untilBedtime > 0 && (
          <p className={styles.hint}>
            {t("отход ко сну в {0} — через {1}", [
              bedtime.time ?? "",
              formatDuration(untilBedtime),
            ])}
          </p>
        )}
      </div>

      {nightSleep && (
        <NightFeedingsSheet
          open
          onClose={() => setNightSleep(null)}
          session={nightSleep}
        />
      )}
    </>
  );
}
