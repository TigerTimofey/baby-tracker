import { getOnline, subscribeOnline } from "../../data/presence";
import { t } from "../../lib/i18n";
import { useState, useSyncExternalStore } from "react";
import { Card } from "../../components/ui/Card";
import { Icon } from "../../components/ui/Icon";
import { showToast } from "../../components/ui/toast";
import { inviteLink } from "../../data/invite";
import {
  getSyncStatus,
  subscribeSync,
  type FamilyMember,
} from "../../data/sync";
import styles from "./FamilyCard.module.css";

function Avatar({ member }: { member: FamilyMember }) {
  const [broken, setBroken] = useState(false);
  const initial = member.display_name?.trim().slice(0, 1).toUpperCase();

  if (member.avatar_url && !broken) {
    return (
      <span className={styles.circle}>
        <img
          className={styles.photo}
          src={member.avatar_url}
          alt=""
          referrerPolicy="no-referrer"
          onError={() => setBroken(true)}
        />
      </span>
    );
  }

  return (
    <span className={styles.circle}>
      {initial ?? <Icon name="baby" size={24} />}
    </span>
  );
}

export function FamilyCard() {
  const online = useSyncExternalStore(subscribeOnline, getOnline, getOnline);
  const status = useSyncExternalStore(
    subscribeSync,
    getSyncStatus,
    getSyncStatus,
  );

  if (!status.email || status.members.length === 0) return null;

  async function share() {
    if (!status.inviteCode) return;
    const link = inviteLink(status.inviteCode);
    try {
      if (navigator.share) {
        await navigator.share({
          title: "Sebason",
          text: t("Приглашение в семью"),
          url: link,
        });
        return;
      }
      await navigator.clipboard.writeText(link);
      showToast(t("Ссылка скопирована — отправьте её второму родителю"));
    } catch {
      void 0;
    }
  }

  const alone = status.members.length < 2;

  return (
    <Card title={t("Семья")}>
      <div className={styles.row}>
        {status.members.map((member) => {
          const isMe = member.user_id === status.userId;
          return (
            <div key={member.user_id} className={styles.member}>
              <span className={styles.avatar}>
                <Avatar member={member} />
                <span
                  className={`${styles.dot} ${online.includes(member.user_id) ? styles.on : ""}`}
                  aria-label={
                    online.includes(member.user_id) ? t("в сети") : t("не в сети")
                  }
                />
              </span>
              <span className={`${styles.name} ${isMe ? styles.me : ""}`}>
                {member.display_name ?? (isMe ? t("вы") : t("второй родитель"))}
              </span>
            </div>
          );
        })}

        {status.inviteCode && (
          <button
            type="button"
            className={styles.member}
            onClick={() => void share()}
          >
            <span className={`${styles.circle} ${styles.invite}`}>
              <Icon name="plus" size={22} />
            </span>
            <span className={styles.name}>{t("Пригласить")}</span>
          </button>
        )}
      </div>

      {alone && (
        <p className={styles.hint}>
          {t("Отправьте ссылку второму родителю — он войдёт в свой аккаунт и увидит\n          те же записи.")}
        </p>
      )}
    </Card>
  );
}
