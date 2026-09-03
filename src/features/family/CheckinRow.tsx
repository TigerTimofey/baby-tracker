import { useCallback, useState, useSyncExternalStore } from "react";
import { Button } from "../../components/ui/Button";
import { Segmented } from "../../components/ui/Segmented";
import { getSyncStatus, subscribeSync } from "../../data/sync";
import { t } from "../../lib/i18n";
import { formatDuration } from "../../lib/time";
import { askCheckin, myLastCheckin, type Checkin } from "./checkin";
import { useCheckinWatch } from "./useCheckinWatch";
import styles from "./CheckinRow.module.css";

/**
 * «Всё по плану?» — вопрос второму родителю вместо прежнего пробного
 * уведомления. Пробное проверяло технику и больше ничего не давало; этот
 * вопрос проверяет ровно то же самое, но по дороге ещё и нужен.
 *
 * Строки нет, пока в семье один человек: спрашивать некого.
 */
export function CheckinRow() {
  const status = useSyncExternalStore(subscribeSync, getSyncStatus, getSyncStatus);
  const others = status.members.filter(
    (member) => member.user_id !== status.userId,
  );

  const [to, setTo] = useState<string | null>(null);
  const [last, setLast] = useState<Checkin | null>(null);
  const [sending, setSending] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const userId = status.userId;

  const look = useCallback(() => {
    if (!userId) return;
    void myLastCheckin(userId).then(setLast);
  }, [userId]);

  // Опрашиваем, только пока ждём ответа: в остальное время меняться нечему.
  useCheckinWatch(look, last && !last.answer ? 15_000 : null);

  if (others.length === 0) return null;

  const target = to ?? others[0].user_id;
  const targetName =
    others.find((member) => member.user_id === target)?.display_name ??
    t("второй родитель");

  const send = async () => {
    setSending(true);
    setNote(null);
    const result = await askCheckin(target);
    setSending(false);

    if (!result.ok) {
      setNote(t("Не отправилось — попробуйте ещё раз"));
      return;
    }
    // Запись создана в любом случае — вопрос не пропадёт. Но обещать
    // «уведомление ушло», когда его никто не получил, нельзя.
    //
    // Раньше здесь было два разных текста: «не включены уведомления» и
    // «подписка устарела». Для родителя это одно и то же — уведомление не
    // придёт, — а разница нужна только при разборе, и она есть в консоли.
    if (result.sent === 0) {
      setNote(
        t("У {0} уведомления сейчас не приходят — вопрос увидят, когда откроют приложение.", [targetName]),
      );
    }
    if (userId) setLast(await myLastCheckin(userId));
  };

  const answered = last?.answer ?? null;
  const waiting = last && !last.answer;

  return (
    <div className={styles.row}>
      <div className={styles.text}>
        <div className={styles.label}>{t("Спросить: всё по плану?")}</div>
        <div className={styles.hint}>
          {answered && last
            ? t("{0} ответил {1} назад: {2}", [
                targetName,
                formatDuration(Date.now() - Date.parse(last.answered_at ?? last.asked_at)),
                answered === "ok" ? t("всё хорошо") : t("не очень"),
              ])
            : waiting && last
              ? t("Спросили {0} назад, ответа пока нет", [
                  formatDuration(Date.now() - Date.parse(last.asked_at)),
                ])
              : t("Придёт уведомлением, ответ — одним нажатием")}
        </div>

        {others.length > 1 && (
          <div className={styles.pick}>
            <Segmented
              value={target}
              onChange={setTo}
              ariaLabel={t("Кого спросить")}
              options={others.map((member) => ({
                value: member.user_id,
                label: member.display_name ?? t("второй родитель"),
              }))}
            />
          </div>
        )}

        {note && <div className={styles.note}>{note}</div>}
      </div>

      <Button size="sm" variant="secondary" disabled={sending} onClick={send}>
        {t("Спросить")}
      </Button>
    </div>
  );
}
