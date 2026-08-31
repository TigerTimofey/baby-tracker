import { pluralOf, t } from "../../lib/i18n";
import { Fragment, useState } from "react";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Icon } from "../../components/ui/Icon";
import { useAuthorPair, useLive, useNow } from "../../data/hooks";
import { listByChild, save } from "../../data/repo";
import type { Feeding, SleepSession } from "../../data/types";
import {
  formatDayLabel,
  formatDuration,
  formatTime,
} from "../../lib/time";
import { FeedingEditor } from "../feeding/FeedingEditor";
import {
  durationMs as feedingDuration,
  kindShort,
  startMs as feedingStart,
} from "../feeding/feedingUtils";
import { SleepEditor } from "../sleep/SleepEditor";
import {
  durationMs as sleepDuration,
  needsFeedBeforeHint,
  nightFeedingsLabel,
  startMs as sleepStart,
} from "../sleep/sleepUtils";
import styles from "./DayLog.module.css";

const NO_FEEDINGS: Feeding[] = [];

type Entry =
  | { kind: "sleep"; at: number; session: SleepSession }
  | { kind: "feed"; at: number; feeding: Feeding };

interface Day {
  key: string;
  date: Date;
  entries: Entry[];
  sleepMs: number;
  feeds: number;
}

/** Сон и кормления в одной ленте: их и смотрят вместе, а не по отдельности. */
function buildDays(
  sessions: SleepSession[],
  feedings: Feeding[],
  now: number,
): Day[] {
  const entries: Entry[] = [
    ...sessions.map(
      (session): Entry => ({
        kind: "sleep",
        at: sleepStart(session),
        session,
      }),
    ),
    ...feedings.map(
      (feeding): Entry => ({
        kind: "feed",
        at: feedingStart(feeding),
        feeding,
      }),
    ),
  ].sort((a, b) => b.at - a.at);

  const days = new Map<string, Day>();
  for (const entry of entries) {
    const at = new Date(entry.at);
    at.setHours(0, 0, 0, 0);
    const key = at.toDateString();

    const day = days.get(key) ?? {
      key,
      date: at,
      entries: [],
      sleepMs: 0,
      feeds: 0,
    };
    day.entries.push(entry);
    if (entry.kind === "sleep") {
      day.sleepMs += sleepDuration(entry.session, now);
    } else {
      day.feeds += 1;
    }
    days.set(key, day);
  }

  return [...days.values()].sort(
    (a, b) => b.date.getTime() - a.date.getTime(),
  );
}

interface DayLogProps {
  childId: string;
  sessions: SleepSession[];
}

export function DayLog({ childId, sessions }: DayLogProps) {
  const now = useNow(30_000);
  const people = useAuthorPair();
  const [editSleep, setEditSleep] = useState<SleepSession | null>(null);
  const [editFeed, setEditFeed] = useState<Feeding | null>(null);
  const [addSleep, setAddSleep] = useState(false);
  const [addFeed, setAddFeed] = useState(false);
  const [feedFor, setFeedFor] = useState<SleepSession | null>(null);
  const [showSleep, setShowSleep] = useState(true);
  const [showFeed, setShowFeed] = useState(true);

  const { data } = useLive(
    async () => await listByChild("feedings", childId),
    [childId],
  );
  const feedings = data ?? NO_FEEDINGS;

  // Отключить оба фильтра нельзя: пустая лента без объяснения выглядела бы
  // поломкой, поэтому последний включённый не гасим.
  const toggle = (which: "sleep" | "feed") => {
    if (which === "sleep") {
      if (showSleep && !showFeed) return;
      setShowSleep(!showSleep);
    } else {
      if (showFeed && !showSleep) return;
      setShowFeed(!showFeed);
    }
  };

  const days = buildDays(
    showSleep ? sessions : [],
    showFeed ? feedings : [],
    now,
  );

  return (
    <section className={styles.section}>
      <div className={styles.header}>
        <h2 className={styles.title}>{t("История")}</h2>
        <span className={styles.headerActions}>
          <Button
            size="sm"
            variant={showSleep ? "secondary" : "ghost"}
            aria-pressed={showSleep}
            onClick={() => toggle("sleep")}
          >
            <Icon name="moon" size={15} />
            {t("Сон")}
          </Button>
          <Button
            size="sm"
            variant={showFeed ? "secondary" : "ghost"}
            aria-pressed={showFeed}
            onClick={() => toggle("feed")}
          >
            <Icon name="bottle" size={15} />
            {t("Кормление")}
          </Button>
        </span>
      </div>

      {days.length === 0 ? (
        <Card title={t("Сон и кормления")}>
          <p className={styles.intro}>
            {showSleep && showFeed
              ? t("Ни одной записи. Добавьте первую — приложение соберёт историю по дням и посчитает, сколько малыш спал и сколько ел.")
              : showSleep
                ? t("Записей сна пока нет.")
                : t("Записей кормления пока нет.")}
          </p>
          <div className={styles.introAction}>
            <Button variant="primary" onClick={() => setAddSleep(true)}>
              <Icon name="moon" size={17} />
              {t("Добавить сон")}
            </Button>
            <Button variant="secondary" onClick={() => setAddFeed(true)}>
              <Icon name="bottle" size={17} />
              {t("Добавить кормление")}
            </Button>
          </div>
        </Card>
      ) : (
        days.map((day) => (
          <div key={day.key} className={styles.day}>
            <div className={styles.dayHeader}>
              <span className={styles.dayLabel}>
                {formatDayLabel(day.date)}
              </span>
              <span className={styles.dayTotal}>
                {[
                  day.sleepMs > 0 ? t("сон {0}", [formatDuration(day.sleepMs)]) : null,
                  day.feeds > 0
                    ? `${day.feeds} ${pluralOf(day.feeds, "кормление")}`
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </div>

            <div className={styles.list}>
              {day.entries.map((entry) => {
                if (entry.kind === "feed") {
                  const feeding = entry.feeding;
                  const parts = [
                    kindShort(feeding.kind),
                    feeding.amount_ml === null
                      ? null
                      : t("{0} мл", [feeding.amount_ml]),
                    feeding.food,
                    feeding.note,
                    people(
                      feeding.created_by,
                      feeding.ended_by,
                      t("начали"),
                      t("закончили"),
                    ),
                  ].filter(Boolean);

                  return (
                    <button
                      key={feeding.id}
                      type="button"
                      className={styles.row}
                      onClick={() => setEditFeed(feeding)}
                    >
                      <span className={`${styles.icon} ${styles.feed}`}>
                        <Icon name="bottle" size={16} />
                      </span>
                      <span className={styles.body}>
                        <span className={styles.range}>
                          {formatTime(feeding.start_at)} →{" "}
                          {feeding.end_at
                            ? formatTime(feeding.end_at)
                            : t("сейчас")}
                        </span>
                        <span className={styles.note}>{parts.join(" · ")}</span>
                      </span>
                      <span
                        className={`${styles.duration} ${
                          feeding.end_at === null ? styles.live : ""
                        } tnum`}
                      >
                        {formatDuration(feedingDuration(feeding, now))}
                      </span>
                    </button>
                  );
                }

                const session = entry.session;
                const parts = [
                  nightFeedingsLabel(session),
                  session.note,
                  people(
                    session.created_by,
                    session.ended_by,
                    t("уложили"),
                    t("подняли"),
                  ),
                ].filter(Boolean);

                return (
                  <Fragment key={session.id}>
                    <button
                      type="button"
                      className={styles.row}
                      onClick={() => setEditSleep(session)}
                    >
                      <span
                        className={`${styles.icon} ${
                          session.kind === "nap" ? styles.nap : ""
                        }`}
                      >
                        <Icon
                          name={session.kind === "night" ? "moon" : "sun"}
                          size={16}
                        />
                      </span>
                      <span className={styles.body}>
                        <span className={styles.range}>
                          {formatTime(session.start_at)} →{" "}
                          {session.end_at
                            ? formatTime(session.end_at)
                            : t("сейчас")}
                        </span>
                        {parts.length > 0 && (
                          <span className={styles.note}>
                            {parts.join(" · ")}
                          </span>
                        )}
                      </span>
                      <span
                        className={`${styles.duration} ${
                          session.end_at === null ? styles.live : ""
                        } tnum`}
                      >
                        {formatDuration(sleepDuration(session, now))}
                      </span>
                    </button>

                    {needsFeedBeforeHint(session, feedings) && (
                      <div className={styles.hint}>
                        <span className={styles.hintText}>
                          {t("Кормление перед сном не отмечено")}
                        </span>
                        <span className={styles.hintActions}>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setFeedFor(session)}
                          >
                            {t("Добавить")}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              void save("sleep_sessions", {
                                ...session,
                                no_feed_before: true,
                              })
                            }
                          >
                            {t("Не было")}
                          </Button>
                        </span>
                      </div>
                    )}
                  </Fragment>
                );
              })}
            </div>
          </div>
        ))
      )}

      {addSleep && (
        <SleepEditor
          open
          onClose={() => setAddSleep(false)}
          childId={childId}
        />
      )}
      {addFeed && (
        <FeedingEditor open onClose={() => setAddFeed(false)} childId={childId} />
      )}
      {feedFor && (
        <FeedingEditor
          key={`before-${feedFor.id}`}
          open
          onClose={() => setFeedFor(null)}
          childId={childId}
          initialAt={new Date(sleepStart(feedFor) - 15 * 60_000)}
          initialEndAt={new Date(sleepStart(feedFor))}
        />
      )}
      {editSleep && (
        <SleepEditor
          key={editSleep.id}
          open
          onClose={() => setEditSleep(null)}
          childId={childId}
          session={editSleep}
        />
      )}
      {editFeed && (
        <FeedingEditor
          key={editFeed.id}
          open
          onClose={() => setEditFeed(null)}
          childId={childId}
          feeding={editFeed}
        />
      )}
    </section>
  );
}
