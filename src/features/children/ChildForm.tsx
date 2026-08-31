import { pluralOf, t } from "../../lib/i18n";
import { useRef, useState, type FormEvent } from "react";

import { Button } from "../../components/ui/Button";
import {
  Field,
  FormActions,
  FormRow,
  TextInput,
} from "../../components/ui/Form";
import { ChildAvatar } from "../../components/ui/ChildAvatar";
import { Icon } from "../../components/ui/Icon";
import { PhotoCropper } from "./PhotoCropper";
import { Segmented } from "../../components/ui/Segmented";
import { Sheet } from "../../components/ui/Sheet";
import {
  countChildRecords,
  deleteChildDeep,
  newId,
  nowISO,
  restoreChildDeep,
  save,
} from "../../data/repo";
import { showToast } from "../../components/ui/toast";
import { updateSettings } from "../../data/settings";
import type { Child, Sex } from "../../data/types";
import styles from "./ChildForm.module.css";
import {
  cmToMm,
  gramsToKgInput,
  kgToGrams,
  mmToCmInput,
  trimOrNull,
} from "../../lib/parse";

interface ChildFormProps {
  open: boolean;
  onClose: () => void;
  child?: Child;
  canDelete?: boolean;
}

type SexChoice = Sex | "unset";

function todayISO(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function ChildForm({
  open,
  onClose,
  child,
}: ChildFormProps) {
  const [name, setName] = useState(child?.name ?? "");
  const [photo, setPhoto] = useState<string | null>(child?.photo ?? null);
  const pickInput = useRef<HTMLInputElement>(null);
  const [cropping, setCropping] = useState<File | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [birthDate, setBirthDate] = useState(child?.birth_date ?? todayISO());
  const [birthTime, setBirthTime] = useState(child?.birth_time ?? "");
  const [sex, setSex] = useState<SexChoice>(child?.sex ?? "unset");
  const [weight, setWeight] = useState(
    gramsToKgInput(child?.birth_weight_g ?? null),
  );
  const [height, setHeight] = useState(
    mmToCmInput(child?.birth_height_mm ?? null),
  );
  const [error, setError] = useState<string | null>(null);

  function takePhoto(input: HTMLInputElement) {
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setPhotoError(t("Это не изображение"));
      return;
    }
    // Кадрирует человек, а не приложение: центр снимка редко совпадает с лицом.
    setPhotoError(null);
    setCropping(file);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    if (!name.trim()) {
      setError(t("Как зовут малыша?"));
      return;
    }
    if (!birthDate) {
      setError(t("Укажите дату рождения"));
      return;
    }
    if (new Date(birthDate) > new Date()) {
      setError(t("Дата рождения не может быть в будущем"));
      return;
    }

    const record: Child = {
      id: child?.id ?? newId(),
      family_id: child?.family_id ?? null,
      name: name.trim(),
      birth_date: birthDate,
      birth_time: trimOrNull(birthTime),
      sex: sex === "unset" ? null : sex,
      photo,
      birth_weight_g: kgToGrams(weight),
      birth_height_mm: cmToMm(height),
      bedtime: child?.bedtime ?? null,
      bedtime_warn_minutes: child?.bedtime_warn_minutes ?? null,
      notify_bedtime: child?.notify_bedtime ?? true,
      notify_wake_window: child?.notify_wake_window ?? true,
      updated_at: child?.updated_at ?? nowISO(),
      deleted: false,
      created_by: child?.created_by ?? null,
    };

    await save("children", record);

    if (!child) updateSettings({ activeChildId: record.id });
    onClose();
  }

  async function handleDelete() {
    if (!child) return;

    const counts = await countChildRecords(child.id);
    const details = [
      counts.sleep_sessions &&
        `${counts.sleep_sessions} ${pluralOf(counts.sleep_sessions, "запись сна")}`,
      counts.measurements &&
        `${counts.measurements} ${pluralOf(counts.measurements, "измерение")}`,
    ]
      .filter(Boolean)
      .join(", ");

    const confirmed = window.confirm(
      t("Удалить профиль «{0}»?", [child.name]) +
        (details ? t("\n\nВместе с ним удалится: {0}.", [details]) : "") +
        t("\n\nОтменить это будет нельзя."),
    );
    if (!confirmed) return;

    const token = await deleteChildDeep(child.id);
    const name = child.name;
    updateSettings({ activeChildId: null });
    onClose();
    showToast(t("Профиль «{0}» удалён", [name]), {
      label: t("Отменить"),
      run: async () => {
        await restoreChildDeep(token);
        updateSettings({ activeChildId: token.childId });
      },
    });
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={child ? t("Профиль малыша") : t("Добавить малыша")}
      subtitle={
        child ? undefined : t("Дата рождения нужна, чтобы считать возраст и нормы")
      }
    >
      <form onSubmit={handleSubmit}>
        <div className={styles.photoRow}>
          <ChildAvatar
            child={{ ...(child ?? ({} as Child)), name, photo }}
            size={64}
          />
          <div className={styles.photoText}>
            <div className={styles.photoLabel}>{t("Фото")}</div>
            <div className={styles.photoHint}>
              {photoError ?? t("Появится в кружке наверху")}
            </div>
            <div className={styles.photoButtons}>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => pickInput.current?.click()}
              >
                {t("Добавить")}
              </Button>
              {photo && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                    onClick={() => {
                    setPhotoError(null);
                    setPhoto(null);
                  }}
                >
                  {t("Убрать")}
                </Button>
              )}
            </div>
          </div>
          <input
            ref={pickInput}
            type="file"
            accept="image/*"
            hidden
            onChange={(event) => takePhoto(event.target)}
          />
        </div>

        <Field label={t("Имя")}>
          {(id) => (
            <TextInput
              id={id}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("Например, Лев")}
              autoComplete="off"
              autoFocus={!child}
            />
          )}
        </Field>

        <FormRow>
          <Field label={t("Дата рождения")}>
            {(id) => (
              <TextInput
                id={id}
                type="date"
                value={birthDate}
                max={todayISO()}
                onChange={(e) => setBirthDate(e.target.value)}
              />
            )}
          </Field>
          <Field label={t("Время")} hint={t("если знаете")}>
            {(id) => (
              <TextInput
                id={id}
                type="time"
                value={birthTime}
                onChange={(e) => setBirthTime(e.target.value)}
              />
            )}
          </Field>
        </FormRow>

        <Field label={t("Пол")}>
          {(id) => (
            <Segmented<SexChoice>
              id={id}
              value={sex}
              onChange={setSex}
              ariaLabel={t("Пол")}
              options={[
                { value: "male", label: t("Мальчик") },
                { value: "female", label: t("Девочка") },
                { value: "unset", label: t("Не важно") },
              ]}
            />
          )}
        </Field>

        <FormRow>
          <Field label={t("Вес при рождении")}>
            {(id) => (
              <TextInput
                id={id}
                inputMode="decimal"
                suffix={t("кг")}
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                placeholder={t("3,45")}
              />
            )}
          </Field>
          <Field label={t("Рост при рождении")}>
            {(id) => (
              <TextInput
                id={id}
                inputMode="decimal"
                suffix={t("см")}
                value={height}
                onChange={(e) => setHeight(e.target.value)}
                placeholder="52"
              />
            )}
          </Field>
        </FormRow>

        {error && (
          <p style={{ color: "var(--danger)", fontSize: 14 }}>{error}</p>
        )}

        <FormActions>
          <Button variant="secondary" onClick={onClose}>
            {t("Отмена")}
          </Button>
          <Button type="submit" variant="primary">
            {t("Сохранить")}
          </Button>
        </FormActions>

        {child && (
          <div className={styles.danger}>
            <Button variant="danger" block onClick={handleDelete}>
              <Icon name="trash" size={17} />
              {t("Удалить профиль")}
            </Button>
          </div>
        )}
      </form>
      {cropping && (
        <PhotoCropper
          file={cropping}
          onCancel={() => setCropping(null)}
          onDone={(next) => {
            setPhoto(next);
            setCropping(null);
          }}
        />
      )}
    </Sheet>
  );
}
