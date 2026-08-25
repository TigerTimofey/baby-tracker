import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
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
  pushConfigured,
  pushSupported,
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
  showNotification,
} from "../lib/notifications";
import { formatDate } from "../lib/time";
import { APP_VERSION } from "../lib/version";
import styles from "./SettingsPage.module.css";

const WARN_OPTIONS = ["15", "30", "60"] as const;

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
  const [pushNote, setPushNote] = useState<string | null>(null);

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
        `Загружено записей: ${result.imported}. Пропущено как более старые: ${result.skipped}.`,
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
          aria-label="Назад"
        >
          <Icon name="chevron-left" size={22} />
        </button>
        <h1 className={styles.title}>Настройки</h1>
      </div>

      <div className={styles.stack}>
        <FamilyCard />

        <Card title="Малыш">
          <div className={styles.row}>
            <div className={styles.rowText}>
              <div className={styles.rowLabel}>{child?.name ?? "Не задан"}</div>
              <div className={styles.rowHint}>
                {child
                  ? `родился ${formatDate(child.birth_date)}`
                  : "добавьте профиль"}
              </div>
            </div>
            <Button size="sm" variant="secondary" onClick={() => setEditOpen(true)}>
              Изменить
            </Button>
          </div>
        </Card>

        <Card title="Сон">
          <div className={styles.row}>
            <div className={styles.rowText}>
              <div className={styles.rowLabel}>Отход ко сну</div>
              <div className={styles.rowHint}>
                Приложение напомнит, что пора укладываться
              </div>
            </div>
            <input
              type="time"
              aria-label="Время отхода ко сну"
              className={styles.timeInput}
              value={bedtime.time ?? ""}
              onChange={(event) => setBedtime(event.target.value || null)}
            />
          </div>

          <div className={styles.row}>
            <div className={styles.rowText}>
              <div className={styles.rowLabel}>Уведомления</div>
              <div className={styles.rowHint}>
                {permission === "unsupported"
                  ? "Этот браузер не умеет их показывать"
                  : permission === "denied"
                    ? "Разрешение отклонено — включите его в настройках браузера"
                    : "Напомнят про сон и про долгое бодрствование"}
              </div>
            </div>
            <Switch
              label="Уведомления"
              disabled={permission === "unsupported" || permission === "denied"}
              checked={settings.notifications && permission === "granted"}
              onChange={async (next) => {
                if (!next) {
                  updateSettings({ notifications: false });
                  setPushNote(null);
                  await disablePush();
                  return;
                }

                const granted = await requestNotificationPermission();
                setPermission(granted);
                updateSettings({ notifications: granted === "granted" });
                if (granted !== "granted") return;

                if (!pushSupported()) {
                  setPushNote(
                    "Этот браузер не умеет получать уведомления с сервера — напоминания придут, только пока приложение открыто.",
                  );
                  return;
                }
                if (!pushConfigured()) {
                  setPushNote(
                    "Серверные уведомления не настроены: нет VITE_VAPID_PUBLIC_KEY. Напоминания придут, только пока приложение открыто.",
                  );
                  return;
                }

                const result = await enablePush(getSyncStatus().familyId);
                setPushNote(
                  result.ok
                    ? "Уведомления придут, даже если приложение закрыто."
                    : result.reason === "no-account"
                      ? "Войдите в аккаунт, чтобы уведомления приходили при закрытом приложении."
                      : "Не удалось подписаться на серверные уведомления. Напоминания придут, пока приложение открыто.",
                );
              }}
            />
          </div>

          {pushNote && <p className={styles.rowHint}>{pushNote}</p>}

          {settings.notifications && permission === "granted" && child && (
            <>
              <div className={styles.row}>
                <div className={styles.rowText}>
                  <div className={styles.rowLabel}>Напомнить об отходе ко сну</div>
                  <div className={styles.rowHint}>
                    За {bedtime.warnMinutes} мин до {bedtime.time ?? "—"} и в
                    само время сна
                  </div>
                </div>
                <Switch
                  label="Напоминание об отходе ко сну"
                  checked={child.notify_bedtime}
                  onChange={(value) =>
                    void save("children", { ...child, notify_bedtime: value })
                  }
                />
              </div>

              <div className={styles.row}>
                <div className={styles.rowText}>
                  <div className={styles.rowLabel}>Если долго не спит</div>
                  <div className={styles.rowHint}>
                    Когда бодрствует дольше возрастного ориентира
                  </div>
                </div>
                <Switch
                  label="Напоминание о долгом бодрствовании"
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

          {settings.notifications && permission === "granted" && (
            <div className={styles.row}>
              <div className={styles.rowText}>
                <div className={styles.rowLabel}>Проверить</div>
                <div className={styles.rowHint}>
                  Придёт пробное уведомление
                </div>
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={() =>
                  void showNotification(
                    "test",
                    "Проверка",
                    "Уведомления работают",
                  )
                }
              >
                Отправить
              </Button>
            </div>
          )}

          <div className={styles.row}>
            <div className={styles.rowText}>
              <div className={styles.rowLabel}>Предупредить заранее</div>
              <div className={styles.rowHint}>минут до отхода ко сну</div>
            </div>
            <div style={{ width: 170 }}>
              <Segmented
                value={String(bedtime.warnMinutes)}
                onChange={(value) => setWarnMinutes(Number(value))}
                ariaLabel="За сколько предупредить"
                options={WARN_OPTIONS.map((value) => ({
                  value,
                  label: value,
                }))}
              />
            </div>
          </div>
        </Card>

        <Card title="Вид">
          <Segmented<Settings["theme"]>
            value={settings.theme}
            onChange={(theme) => updateSettings({ theme })}
            ariaLabel="Тема оформления"
            options={[
              { value: "dark", label: "Тёмная" },
              { value: "light", label: "Светлая" },
              { value: "system", label: "Как в системе" },
            ]}
          />

          <div className={styles.row} style={{ marginTop: "var(--gap-4)" }}>
            <div className={styles.rowText}>
              <div className={styles.rowLabel}>Ночной режим</div>
              <div className={styles.rowHint}>
                Тёплые тона без синего света и крупные кнопки. Включается сам в
                заданные часы и перекрывает выбранную тему.
              </div>
            </div>
            <Switch
              label="Ночной режим"
              checked={settings.nightMode}
              onChange={(nightMode) => updateSettings({ nightMode })}
            />
          </div>

          {settings.nightMode && (
            <>
              <div className={styles.row}>
                <div className={styles.rowText}>
                  <div className={styles.rowLabel}>Включать</div>
                  <div className={styles.rowHint}>
                    {isNightWindow(settings.nightFrom, settings.nightTo)
                      ? "сейчас активен"
                      : `сейчас день — включится в ${settings.nightFrom}`}
                  </div>
                </div>
                <input
                  type="time"
                  aria-label="Начало ночного режима"
                  className={styles.timeInput}
                  value={settings.nightFrom}
                  onChange={(event) =>
                    updateSettings({ nightFrom: event.target.value || "00:00" })
                  }
                />
              </div>

              <div className={styles.row}>
                <div className={styles.rowText}>
                  <div className={styles.rowLabel}>Выключать</div>
                  <div className={styles.rowHint}>утром, когда встаёте</div>
                </div>
                <input
                  type="time"
                  aria-label="Конец ночного режима"
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

        <Card title="Резервная копия">
          <p className={styles.rowHint} style={{ marginBottom: 12 }}>
            Файл со всеми записями. Пригодится, если браузер очистит данные или
            захочется перенести дневник в другое место.
          </p>
          <div className={styles.buttons}>
            <Button
              variant="secondary"
              onClick={() => void downloadBackup()}
            >
              Выгрузить файл
            </Button>
            <Button
              variant="secondary"
              onClick={() => fileInput.current?.click()}
            >
              Загрузить из файла
            </Button>
          </div>
          {storage?.supported && (
            <div className={styles.row} style={{ marginTop: "var(--gap-4)" }}>
              <div className={styles.rowText}>
                <div className={styles.rowLabel}>
                  {storage.persisted
                    ? "Хранилище защищено"
                    : "Хранилище не защищено"}
                </div>
                <div className={styles.rowHint}>
                  {storage.persisted
                    ? "Браузер не удалит записи при нехватке места"
                    : "Браузер вправе удалить записи при нехватке места"}
                  {storage.usageBytes != null
                    ? ` · занято ${formatBytes(storage.usageBytes)}`
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
                  Защитить
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
