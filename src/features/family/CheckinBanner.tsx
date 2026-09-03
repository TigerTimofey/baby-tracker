import { useCallback, useState, useSyncExternalStore } from "react";
import { Button } from "../../components/ui/Button";
import { Icon } from "../../components/ui/Icon";
import { showToast } from "../../components/ui/toast";
import { getSyncStatus, subscribeSync } from "../../data/sync";
import { t } from "../../lib/i18n";
import { formatDuration } from "../../lib/time";
import {
  answerCheckin,
  incomingCheckin,
  myLastCheckin,
  type Checkin,
} from "./checkin";
import { useCheckinWatch } from "./useCheckinWatch";
import styles from "./CheckinBanner.module.css";

/**
 * Две карточки на одном месте: вопрос от второго родителя и ответ на свой.
 *
 * Вопрос висит, пока не ответишь: это не уведомление, которое можно смахнуть,
 * а прямой вопрос, и спросивший ждёт. Ответ, наоборот, закрывается кнопкой —
 * прочитал и убрал.
 *
 * Если пришло и то и другое, показываем вопрос: он требует действия, а ответ
 * подождёт своей очереди.
 */
const SEEN_KEY = "malysh.checkinSeen";

function seenId(): string {
  try {
    return localStorage.getItem(SEEN_KEY) ?? "";
  } catch {
    return "";
  }
}

function markSeen(id: string): void {
  try {
    localStorage.setItem(SEEN_KEY, id);
  } catch {
    void 0;
  }
}

export function CheckinBanner() {
  const status = useSyncExternalStore(subscribeSync, getSyncStatus, getSyncStatus);
  const [question, setQuestion] = useState<Checkin | null>(null);
  const [reply, setReply] = useState<Checkin | null>(null);
  const [sending, setSending] = useState(false);
  const userId = status.userId;

  const look = useCallback(() => {
    if (!userId) {
      setQuestion(null);
      setReply(null);
      return;
    }
    void incomingCheckin(userId).then(setQuestion);
    void myLastCheckin(userId).then((last) => {
      setReply(last?.answer && last.id !== seenId() ? last : null);
    });
  }, [userId]);

  useCheckinWatch(look, 20_000);

  const nameOf = (id: string) =>
    status.members.find((member) => member.user_id === id)?.display_name ??
    t("второй родитель");

  if (question) {
    const answer = async (value: "ok" | "not_ok") => {
      setSending(true);
      const result = await answerCheckin(question.id, value);
      setSending(false);
      setQuestion(null);
      showToast(
        result.ok
          ? t("Ответ отправлен")
          : t("Ответ не ушёл — попробуйте ещё раз"),
      );
    };

    return (
      <div className={styles.card}>
        <div className={styles.head}>
          <span className={styles.mark}>
            <Icon name="baby" size={16} />
          </span>
          <div className={styles.text}>
            <div className={styles.title}>{t("Всё по плану?")}</div>
            <div className={styles.who}>
              {t("Спрашивает {0} · {1} назад", [
                nameOf(question.from_user),
                formatDuration(Date.now() - Date.parse(question.asked_at)),
              ])}
            </div>
          </div>
        </div>

        <div className={styles.actions}>
          <Button
            variant="primary"
            size="sm"
            disabled={sending}
            onClick={() => void answer("ok")}
          >
            {t("Всё хорошо")}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={sending}
            onClick={() => void answer("not_ok")}
          >
            {t("Не очень")}
          </Button>
        </div>
      </div>
    );
  }

  if (!reply?.answer) return null;

  const good = reply.answer === "ok";
  const when = Date.parse(reply.answered_at ?? reply.asked_at);

  return (
    <div className={`${styles.card} ${good ? styles.good : styles.bad}`}>
      <div className={styles.head}>
        <span className={styles.mark}>
          <Icon name={good ? "check" : "thermometer"} size={16} />
        </span>
        <div className={styles.text}>
          <div className={styles.title}>
            {good ? t("Всё хорошо") : t("Не очень")}
          </div>
          <div className={styles.who}>
            {t("Ответ от {0} · {1} назад", [
              nameOf(reply.to_user),
              formatDuration(Date.now() - when),
            ])}
          </div>
        </div>
      </div>

      <div className={styles.actions}>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            markSeen(reply.id);
            setReply(null);
          }}
        >
          {t("Понятно")}
        </Button>
      </div>
    </div>
  );
}
