import { useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Icon } from "../components/ui/Icon";
import { Segmented } from "../components/ui/Segmented";
import { Switch } from "../components/ui/Switch";
import { useActiveChild, useSettings } from "../data/hooks";
import { updateSettings } from "../data/settings";
import type { Settings } from "../data/types";
import { ChildForm } from "../features/children/ChildForm";
import { SyncSettings } from "../features/sync/SyncSettings";
import { downloadBackup, restoreBackup } from "../lib/backup";
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
              className={styles.timeInput}
              value={settings.bedtime ?? ""}
              onChange={(e) =>
                updateSettings({ bedtime: e.target.value || null })
              }
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
                  return;
                }
                const granted = await requestNotificationPermission();
                setPermission(granted);
                updateSettings({ notifications: granted === "granted" });
              }}
            />
          </div>

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
                value={String(settings.bedtimeWarnMinutes)}
                onChange={(value) =>
                  updateSettings({ bedtimeWarnMinutes: Number(value) })
                }
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
