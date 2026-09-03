import { t } from "../lib/i18n";
import { ChildAvatar } from "../components/ui/ChildAvatar";
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { LangSwitch } from "../components/ui/LangSwitch";
// Вопрос «всё по плану?» отключён. Код на месте: строка настроек —
// CheckinRow, карточка вопроса — CheckinBanner в AppShell. Вернуть — снять
// комментарии в обоих местах.
// import { CheckinRow } from "../features/family/CheckinRow";
import { Icon } from "../components/ui/Icon";
import { Segmented } from "../components/ui/Segmented";
import { Switch } from "../components/ui/Switch";
import { useActiveChild, useSettings } from "../data/hooks";
import { isNightWindow, updateSettings } from "../data/settings";
import { save } from "../data/repo";
import { bedtimeOf } from "../features/sleep/sleepUtils";
import {
  disablePush,
  enablePush,
  pushStatus,
  type PushState,
} from "../lib/push";
import { getSyncStatus } from "../data/sync";
import type { Settings } from "../data/types";
import { ChildForm } from "../features/children/ChildForm";
import { FamilyCard } from "../features/sync/FamilyCard";
import { SyncSettings } from "../features/sync/SyncSettings";
import { downloadBackup, restoreBackup } from "../lib/backup";
import {
  formatBytes,
  readStorageStatus,
  requestPersistentStorage,
  type StorageStatus,
} from "../lib/storage";
import {
  notificationPermission,
  requestNotificationPermission,
} from "../lib/notifications";
import { formatDate } from "../lib/time";
import { APP_VERSION } from "../lib/version";
import styles from "./SettingsPage.module.css";

const WARN_OPTIONS = ["15", "30", "60"] as const;

/**
 * Что показать про доставку при закрытом приложении. Раньше подпись
 * появлялась один раз, сразу после нажатия тумблера, и потом врала: подписка
 * могла отвалиться, а надпись оставалась прежней.
 */
const PUSH_HINT: Record<PushState, () => string> = {
  on: () => t("Уведомления придут, даже если приложение закрыто."),
  lost: () =>
    t("Подписка потерялась: сейчас напоминания приходят, только пока приложение открыто. Выключите и включите тумблер, чтобы восстановить."),
  off: () =>
    t("Подписка потерялась: сейчас напоминания приходят, только пока приложение открыто. Выключите и включите тумблер, чтобы восстановить."),
  "no-account": () =>
    t("Войдите в аккаунт, чтобы уведомления приходили при закрытом приложении."),
  "not-configured": () =>
    t("Серверные уведомления не настроены: нет VITE_VAPID_PUBLIC_KEY. Напоминания придут, только пока приложение открыто."),
  unsupported: () =>
    t("Этот браузер не умеет получать уведомления с сервера — напоминания придут, только пока приложение открыто."),
};

export function SettingsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const settings = useSettings();

  const goBack = () =>
    location.key === "default" ? navigate("/sleep") : navigate(-1);
  const { child } = useActiveChild();

  const [editOpen, setEditOpen] = useState(false);
  const [permission, setPermission] = useState(notificationPermission);
  const [storage, setStorage] = useState<StorageStatus | null>(null);
  const [pushState, setPushState] = useState<PushState | null>(null);

  useEffect(() => {
    if (!settings.notifications || permission !== "granted") {
      setPushState(null);
      return;
    }
    let alive = true;
    void pushStatus().then((state) => {
      if (alive) setPushState(state);
    });
    return () => {
      alive = false;
    };
  }, [settings.notifications, permission]);

  const bedtime = bedtimeOf(child, settings);

  const setBedtime = (value: string | null) => {
    if (child) void save("children", { ...child, bedtime: value });
    else updateSettings({ bedtime: value });
  };

  const setWarnMinutes = (value: number) => {
    if (child) void save("children", { ...child, bedtime_warn_minutes: value });
    else updateSettings({ bedtimeWarnMinutes: value });
  };

  useEffect(() => {
    void readStorageStatus().then(setStorage);
  }, []);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setMessage(null);
    setError(null);
    try {
      const result = await restoreBackup(await file.text());
      setMessage(
        t("Загружено записей: {0}. Пропущено как более старые: {1}.", [result.imported, result.skipped]),
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }

  return (
    <>
      <div className={styles.top}>
        <button
          type="button"
          className={styles.back}
          onClick={goBack}
          aria-label={t("Назад")}
        >
          <Icon name="chevron-left" size={22} />
        </button>
        <h1 className={styles.title}>{t("Настройки")}</h1>
        <LangSwitch className={styles.lang} />
      </div>

      <div className={styles.stack}>
        <FamilyCard />

        <Card title={t("Малыш")}>
          <div className={styles.row}>
            <div className={styles.person}>
              <ChildAvatar child={child} size={54} />
              <div className={styles.rowText}>
                <div className={styles.rowLabel}>{child?.name ?? t("Не задан")}</div>
                <div className={styles.rowHint}>
                  {child
                    ? t("родился {0}", [formatDate(child.birth_date)])
                    : t("добавьте профиль")}
                </div>
              </div>
            </div>
            <Button size="sm" variant="secondary" onClick={() => setEditOpen(true)}>
              {t("Изменить")}
            </Button>
          </div>

        </Card>

        <Card title={t("Уведомления")}>
          <div className={styles.row}>
            <div className={styles.rowText}>
              <div className={styles.rowLabel}>{t("Включить")}</div>
              <div className={styles.rowHint}>
                {permission === "unsupported"
                  ? t("Этот браузер не умеет их показывать")
                  : permission === "denied"
                    ? t("Разрешение отклонено — включите его в настройках браузера")
                    : t("Напомнят про сон и про долгое бодрствование")}
              </div>
            </div>
            <Switch
              label={t("Уведомления")}
              disabled={permission === "unsupported" || permission === "denied"}
              checked={settings.notifications && permission === "granted"}
              onChange={async (next) => {
                if (!next) {
                  updateSettings({ notifications: false });
                  setPushState(null);
                  await disablePush();
                  return;
                }

                const granted = await requestNotificationPermission();
                setPermission(granted);
                updateSettings({ notifications: granted === "granted" });
                if (granted !== "granted") return;

                await enablePush(getSyncStatus().familyId);
                setPushState(await pushStatus());
              }}
            />
          </div>

          {settings.notifications && permission === "granted" && pushState && (
            <p className={styles.rowHint}>{PUSH_HINT[pushState]()}</p>
          )}

          {settings.notifications && permission === "granted" && child && (
            <>
              <div className={styles.row}>
                <div className={styles.rowText}>
                  <div className={styles.rowLabel}>{t("Напомнить об отходе ко сну")}</div>
                  <div className={styles.rowHint}>
                    {t("За {0} мин до {1} и в само время сна", [
                      bedtime.warnMinutes,
                      bedtime.time ?? "—",
                    ])}
                  </div>
                </div>
                <Switch
                  label={t("Напоминание об отходе ко сну")}
                  checked={child.notify_bedtime}
                  onChange={(value) =>
                    void save("children", { ...child, notify_bedtime: value })
                  }
                />
              </div>

              {child.notify_bedtime && (
                <div className={styles.row}>
                  <div className={styles.rowText}>
                    <div className={styles.rowLabel}>{t("Отход ко сну")}</div>
                    <div className={styles.rowHint}>
                      {t("во сколько напомнить, что пора укладываться")}
                    </div>
                  </div>
                  <input
                    type="time"
                    aria-label={t("Время отхода ко сну")}
                    className={styles.timeInput}
                    value={bedtime.time ?? ""}
                    onChange={(event) => setBedtime(event.target.value || null)}
                  />
                </div>
              )}

              {child.notify_bedtime && (
                <div className={styles.row}>
                  <div className={styles.rowText}>
                    <div className={styles.rowLabel}>{t("Предупредить заранее")}</div>
                    <div className={styles.rowHint}>{t("минут до отхода ко сну")}</div>
                  </div>
                  <div style={{ width: 170 }}>
                    <Segmented
                      value={String(bedtime.warnMinutes)}
                      onChange={(value) => setWarnMinutes(Number(value))}
                      ariaLabel={t("За сколько предупредить")}
                      options={WARN_OPTIONS.map((value) => ({
                        value,
                        label: value,
                      }))}
                    />
                  </div>
                </div>
              )}

              <div className={styles.row}>
                <div className={styles.rowText}>
                  <div className={styles.rowLabel}>{t("Если долго не спит")}</div>
                  <div className={styles.rowHint}>
                    {t("Когда бодрствует дольше возрастного ориентира")}
                  </div>
                </div>
                <Switch
                  label={t("Напоминание о долгом бодрствовании")}
                  checked={child.notify_wake_window}
                  onChange={(value) =>
                    void save("children", {
                      ...child,
                      notify_wake_window: value,
                    })
                  }
                />
              </div>
            </>
          )}

          {/* <CheckinRow /> */}

        </Card>

        <Card title={t("Кормление")}>
          <div className={styles.row}>
            <div className={styles.rowText}>
              <div className={styles.rowLabel}>{t("Различать грудь")}</div>
              <div className={styles.rowHint}>
                {settings.trackBreastSide
                  ? t("Записываем левую и правую отдельно и предлагаем чередовать")
                  : t("Записываем просто «грудь», без стороны")}
              </div>
            </div>
            <Switch
              label={t("Различать левую и правую грудь")}
              checked={settings.trackBreastSide}
              onChange={(trackBreastSide) =>
                updateSettings({ trackBreastSide })
              }
            />
          </div>
        </Card>

        <Card title={t("Вид")}>
          <Segmented<Settings["theme"]>
            value={settings.theme}
            onChange={(theme) => updateSettings({ theme })}
            ariaLabel={t("Тема оформления")}
            options={[
              { value: "dark", label: t("Тёмная") },
              { value: "light", label: t("Светлая") },
              { value: "system", label: t("Как в системе") },
            ]}
          />

          <div className={styles.row} style={{ marginTop: "var(--gap-4)" }}>
            <div className={styles.rowText}>
              <div className={styles.rowLabel}>{t("Ночной режим")}</div>
              <div className={styles.rowHint}>
                {t("Тёплые тона без синего света и крупные кнопки. Включается сам в\n                заданные часы и перекрывает выбранную тему.")}
              </div>
            </div>
            <Switch
              label={t("Ночной режим")}
              checked={settings.nightMode}
              onChange={(nightMode) => updateSettings({ nightMode })}
            />
          </div>

          {settings.nightMode && (
            <>
              <div className={styles.row}>
                <div className={styles.rowText}>
                  <div className={styles.rowLabel}>{t("Включать")}</div>
                  <div className={styles.rowHint}>
                    {isNightWindow(settings.nightFrom, settings.nightTo)
                      ? t("сейчас активен")
                      : t("сейчас день — включится в {0}", [settings.nightFrom])}
                  </div>
                </div>
                <input
                  type="time"
                  aria-label={t("Начало ночного режима")}
                  className={styles.timeInput}
                  value={settings.nightFrom}
                  onChange={(event) =>
                    updateSettings({ nightFrom: event.target.value || "00:00" })
                  }
                />
              </div>

              <div className={styles.row}>
                <div className={styles.rowText}>
                  <div className={styles.rowLabel}>{t("Выключать")}</div>
                  <div className={styles.rowHint}>{t("утром, когда встаёте")}</div>
                </div>
                <input
                  type="time"
                  aria-label={t("Конец ночного режима")}
                  className={styles.timeInput}
                  value={settings.nightTo}
                  onChange={(event) =>
                    updateSettings({ nightTo: event.target.value || "07:00" })
                  }
                />
              </div>
            </>
          )}
        </Card>

        <SyncSettings />

        <Card title={t("Резервная копия")}>
          <p className={styles.rowHint} style={{ marginBottom: 12 }}>
            {t("Файл со всеми записями. Пригодится, если браузер очистит данные или\n            захочется перенести дневник в другое место.")}
          </p>
          <div className={styles.buttons}>
            <Button
              variant="secondary"
              onClick={() => void downloadBackup()}
            >
              {t("Выгрузить файл")}
            </Button>
            <Button
              variant="secondary"
              onClick={() => fileInput.current?.click()}
            >
              {t("Загрузить из файла")}
            </Button>
          </div>
          {storage?.supported && (
            <div className={styles.row} style={{ marginTop: "var(--gap-4)" }}>
              <div className={styles.rowText}>
                <div className={styles.rowLabel}>
                  {storage.persisted
                    ? t("Хранилище защищено")
                    : t("Хранилище не защищено")}
                </div>
                <div className={styles.rowHint}>
                  {storage.persisted
                    ? t("Браузер не удалит записи при нехватке места")
                    : t("Браузер вправе удалить записи при нехватке места")}
                  {storage.usageBytes != null
                    ? t(" · занято {0}", [formatBytes(storage.usageBytes)])
                    : ""}
                </div>
              </div>
              {!storage.persisted && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={async () => {
                    await requestPersistentStorage();
                    setStorage(await readStorageStatus());
                  }}
                >
                  {t("Защитить")}
                </Button>
              )}
            </div>
          )}

          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
              e.target.value = "";
            }}
          />
          {message && <p className={styles.message}>{message}</p>}
          {error && (
            <p className={`${styles.message} ${styles.messageError}`}>{error}</p>
          )}
        </Card>
        <p className={styles.version}>Sebason {APP_VERSION}</p>
      </div>

      {editOpen && child && (
        <ChildForm
          key={child.id}
          open={editOpen}
          onClose={() => setEditOpen(false)}
          child={child}
        />
      )}
    </>
  );
}
