import { useState, type FormEvent } from "react";
import { Button } from "../../components/ui/Button";
import {
  Field,
  FormActions,
  TextInput,
  Textarea,
} from "../../components/ui/Form";
import { DateTimeField } from "../../components/ui/DateTimeField";
import { Segmented } from "../../components/ui/Segmented";
import { Sheet } from "../../components/ui/Sheet";
import { newId, nowISO, save, softDelete } from "../../data/repo";
import type { Feeding, FeedingKind } from "../../data/types";
import { trimOrNull } from "../../lib/parse";
import { resolveLocalInput, toLocalInputValue } from "../../lib/time";

type Family = "breast" | "bottle" | "solid";
type Side = "left" | "right";

const MAX_FEEDING_MS = 6 * 3600_000;

function splitKind(kind: FeedingKind): { family: Family; side: Side } {
  if (kind === "breast_left") return { family: "breast", side: "left" };
  if (kind === "breast_right") return { family: "breast", side: "right" };
  return { family: kind, side: "left" };
}

function joinKind(family: Family, side: Side): FeedingKind {
  if (family === "breast") return side === "left" ? "breast_left" : "breast_right";
  return family;
}

interface FeedingEditorProps {
  open: boolean;
  onClose: () => void;
  childId: string;
  feeding?: Feeding;
  initialKind?: FeedingKind;
}

export function FeedingEditor({
  open,
  onClose,
  childId,
  feeding,
  initialKind = "breast_left",
}: FeedingEditorProps) {
  const initial = splitKind(feeding?.kind ?? initialKind);

  const [start, setStart] = useState(
    toLocalInputValue(feeding?.start_at ?? new Date()),
  );
  const [end, setEnd] = useState(
    feeding?.end_at ? toLocalInputValue(feeding.end_at) : "",
  );
  const [family, setFamily] = useState<Family>(initial.family);
  const [side, setSide] = useState<Side>(initial.side);
  const [amount, setAmount] = useState(
    feeding?.amount_ml == null ? "" : String(feeding.amount_ml),
  );
  const [food, setFood] = useState(feeding?.food ?? "");
  const [note, setNote] = useState(feeding?.note ?? "");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    const startDate = resolveLocalInput(start, feeding?.start_at ?? null);
    if (!startDate) {
      setError("Укажите, когда началось кормление");
      return;
    }
    if (startDate.getTime() > Date.now() + 60_000) {
      setError("Время начала в будущем");
      return;
    }

    let endDate: Date | null = null;
    if (end) {
      endDate = resolveLocalInput(end, feeding?.end_at ?? null);
      if (!endDate) {
        setError("Не удалось разобрать время окончания");
        return;
      }
      if (endDate <= startDate) {
        setError("Окончание должно быть позже начала");
        return;
      }
      if (endDate.getTime() - startDate.getTime() > MAX_FEEDING_MS) {
        setError("Больше шести часов подряд — похоже на опечатку");
        return;
      }
    }

    let amountMl: number | null = null;
    if (family === "bottle" && amount.trim() !== "") {
      const parsed = Number(amount.trim().replace(",", "."));
      if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 2000) {
        setError("Объём похож на опечатку");
        return;
      }
      amountMl = Math.round(parsed);
    }

    const record: Feeding = {
      id: feeding?.id ?? newId(),
      child_id: childId,
      start_at: startDate.toISOString(),
      end_at: endDate ? endDate.toISOString() : null,
      kind: joinKind(family, side),
      amount_ml: amountMl,
      food: family === "solid" ? trimOrNull(food) : null,
      note: trimOrNull(note),
      updated_at: feeding?.updated_at ?? nowISO(),
      deleted: false,
    };

    await save("feedings", record);
    onClose();
  }

  async function handleDelete() {
    if (!feeding) return;
    if (!window.confirm("Удалить эту запись кормления?")) return;
    await softDelete("feedings", feeding.id);
    onClose();
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={feeding ? "Кормление" : "Добавить кормление"}
      subtitle={feeding ? undefined : "Пригодится, если забыли нажать вовремя"}
    >
      <form onSubmit={handleSubmit}>
        <DateTimeField label="Начало" value={start} onChange={setStart} />
        <DateTimeField
          label="Окончание"
          hint={end ? undefined : "пусто — кормление идёт"}
          value={end}
          onChange={setEnd}
        />

        <Field label="Чем кормили">
          {(id) => (
            <Segmented<Family>
              id={id}
              value={family}
              onChange={setFamily}
              ariaLabel="Чем кормили"
              options={[
                { value: "breast", label: "Грудь" },
                { value: "bottle", label: "Бутылочка" },
                { value: "solid", label: "Прикорм" },
              ]}
            />
          )}
        </Field>

        {family === "breast" && (
          <Field label="Сторона">
            {(id) => (
              <Segmented<Side>
                id={id}
                value={side}
                onChange={setSide}
                ariaLabel="Сторона"
                options={[
                  { value: "left", label: "Левая" },
                  { value: "right", label: "Правая" },
                ]}
              />
            )}
          </Field>
        )}

        {family === "bottle" && (
          <Field label="Объём" hint="сколько съел">
            {(id) => (
              <TextInput
                id={id}
                inputMode="numeric"
                suffix="мл"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="120"
              />
            )}
          </Field>
        )}

        {family === "solid" && (
          <Field label="Что ели">
            {(id) => (
              <TextInput
                id={id}
                value={food}
                onChange={(event) => setFood(event.target.value)}
                placeholder="Например, тыквенное пюре"
              />
            )}
          </Field>
        )}

        <Field label="Заметка">
          {(id) => (
            <Textarea
              id={id}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Необязательно"
            />
          )}
        </Field>

        {error && (
          <p style={{ color: "var(--danger)", fontSize: 14 }}>{error}</p>
        )}

        <FormActions>
          {feeding ? (
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
