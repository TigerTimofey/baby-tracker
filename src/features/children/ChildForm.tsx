import { useState, type FormEvent } from "react";
import { plural } from "../../lib/time";
import { Button } from "../../components/ui/Button";
import {
  Field,
  FormActions,
  FormRow,
  TextInput,
} from "../../components/ui/Form";
import { Icon } from "../../components/ui/Icon";
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

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    if (!name.trim()) {
      setError("Как зовут малыша?");
      return;
    }
    if (!birthDate) {
      setError("Укажите дату рождения");
      return;
    }
    if (new Date(birthDate) > new Date()) {
      setError("Дата рождения не может быть в будущем");
      return;
    }

    const record: Child = {
      id: child?.id ?? newId(),
      family_id: child?.family_id ?? null,
      name: name.trim(),
      birth_date: birthDate,
      birth_time: trimOrNull(birthTime),
      sex: sex === "unset" ? null : sex,
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
        `${counts.sleep_sessions} ${plural(counts.sleep_sessions, ["запись сна", "записи сна", "записей сна"])}`,
      counts.measurements &&
        `${counts.measurements} ${plural(counts.measurements, ["измерение", "измерения", "измерений"])}`,
    ]
      .filter(Boolean)
      .join(", ");

    const confirmed = window.confirm(
      `Удалить профиль «${child.name}»?` +
        (details ? `\n\nВместе с ним удалится: ${details}.` : "") +
        "\n\nОтменить это будет нельзя.",
    );
    if (!confirmed) return;

    const token = await deleteChildDeep(child.id);
    const name = child.name;
    updateSettings({ activeChildId: null });
    onClose();
    showToast(`Профиль «${name}» удалён`, {
      label: "Отменить",
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
      title={child ? "Профиль малыша" : "Добавить малыша"}
      subtitle={
        child ? undefined : "Дата рождения нужна, чтобы считать возраст и нормы"
      }
    >
      <form onSubmit={handleSubmit}>
        <Field label="Имя">
          {(id) => (
            <TextInput
              id={id}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Например, Лев"
              autoComplete="off"
              autoFocus={!child}
            />
          )}
        </Field>

        <FormRow>
          <Field label="Дата рождения">
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
          <Field label="Время" hint="если знаете">
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

        <Field label="Пол">
          {(id) => (
            <Segmented<SexChoice>
              id={id}
              value={sex}
              onChange={setSex}
              ariaLabel="Пол"
              options={[
                { value: "male", label: "Мальчик" },
                { value: "female", label: "Девочка" },
                { value: "unset", label: "Не важно" },
              ]}
            />
          )}
        </Field>

        <FormRow>
          <Field label="Вес при рождении">
            {(id) => (
              <TextInput
                id={id}
                inputMode="decimal"
                suffix="кг"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                placeholder="3,45"
              />
            )}
          </Field>
          <Field label="Рост при рождении">
            {(id) => (
              <TextInput
                id={id}
                inputMode="decimal"
                suffix="см"
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
            Отмена
          </Button>
          <Button type="submit" variant="primary">
            Сохранить
          </Button>
        </FormActions>

        {child && (
          <div className={styles.danger}>
            <Button variant="danger" block onClick={handleDelete}>
              <Icon name="trash" size={17} />
              Удалить профиль
            </Button>
          </div>
        )}
      </form>
    </Sheet>
  );
}
