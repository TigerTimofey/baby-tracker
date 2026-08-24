import { useState, type FormEvent } from "react";
import { Button } from "../../components/ui/Button";
import {
  Field,
  FormActions,
  FormRow,
  TextInput,
} from "../../components/ui/Form";
import { Segmented } from "../../components/ui/Segmented";
import { Sheet } from "../../components/ui/Sheet";
import { newId, nowISO, save, softDelete } from "../../data/repo";
import { updateSettings } from "../../data/settings";
import type { Child, Sex } from "../../data/types";
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
  /** Не задан — создаём нового ребёнка. */
  child?: Child;
  /** Можно ли удалить (нельзя, если это единственный профиль). */
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
  canDelete = false,
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
      updated_at: child?.updated_at ?? nowISO(),
      deleted: false,
    };

    await save("children", record);
    // Новый профиль сразу делаем активным.
    if (!child) updateSettings({ activeChildId: record.id });
    onClose();
  }

  async function handleDelete() {
    if (!child) return;
    const confirmed = window.confirm(
      `Удалить профиль «${child.name}» вместе со всеми записями?`,
    );
    if (!confirmed) return;
    await softDelete("children", child.id);
    updateSettings({ activeChildId: null });
    onClose();
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
          {canDelete && child ? (
            <Button variant="danger" onClick={handleDelete}>
              Удалить
            </Button>
          ) : (
            <Button variant="secondary" onClick={onClose}>
              Отмена
            </Button>
          )}
          <Button type="submit" variant="primary">
            Сохранить
          </Button>
        </FormActions>
      </form>
    </Sheet>
  );
}
