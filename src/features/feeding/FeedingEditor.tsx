import { t } from "../../lib/i18n";
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
import { useRecordPeople, useSettings } from "../../data/hooks";
import styles from "./FeedingEditor.module.css";
import {
  currentAuthor,
  newId,
  nowISO,
  restore,
  save,
  softDelete,
} from "../../data/repo";
import { showToast } from "../../components/ui/toast";
import type { Feeding, FeedingKind } from "../../data/types";
import { trimOrNull } from "../../lib/parse";
import { resolveLocalInput, toLocalInputValue } from "../../lib/time";

type Family = "breast" | "bottle" | "solid";
type Side = "left" | "right" | "any";

const MAX_FEEDING_MS = 6 * 3600_000;

function splitKind(kind: FeedingKind): { family: Family; side: Side } {
  if (kind === "breast_left") return { family: "breast", side: "left" };
  if (kind === "breast_right") return { family: "breast", side: "right" };
  if (kind === "breast") return { family: "breast", side: "any" };
  return { family: kind, side: "any" };
}

function joinKind(family: Family, side: Side): FeedingKind {
  if (family !== "breast") return family;
  if (side === "left") return "breast_left";
  if (side === "right") return "breast_right";
  return "breast";
}

interface FeedingEditorProps {
  open: boolean;
  onClose: () => void;
  childId: string;
  feeding?: Feeding;
  initialKind?: FeedingKind;
  /** С какого времени открыть форму — для записи «задним числом». */
  initialAt?: Date;
  /** И до какого: подсказка сразу предлагает готовый отрезок. */
  initialEndAt?: Date;
}

export function FeedingEditor({
  open,
  onClose,
  childId,
  feeding,
  initialKind,
  initialAt,
  initialEndAt,
}: FeedingEditorProps) {
  const settings = useSettings();
  const trackSide = settings.trackBreastSide;
  const initial = splitKind(
    feeding?.kind ?? initialKind ?? (trackSide ? "breast_left" : "breast"),
  );
  // Существующую запись со стороной не прячем даже при выключенной настройке,
  // иначе сохранение молча стёрло бы то, что родитель однажды отметил.
  const showSide = trackSide || initial.side !== "any";

  const [start, setStart] = useState(
    toLocalInputValue(feeding?.start_at ?? initialAt ?? new Date()),
  );
  const [end, setEnd] = useState(
    feeding?.end_at
      ? toLocalInputValue(feeding.end_at)
      : initialEndAt
        ? toLocalInputValue(initialEndAt)
        : "",
  );
  const [family, setFamily] = useState<Family>(initial.family);
  const [side, setSide] = useState<Side>(initial.side);
  const [amount, setAmount] = useState(
    feeding?.amount_ml == null ? "" : String(feeding.amount_ml),
  );
  const [food, setFood] = useState(feeding?.food ?? "");
  const [note, setNote] = useState(feeding?.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const people = useRecordPeople();
  const who = feeding
    ? people(feeding.created_by, feeding.ended_by, t("начали"), t("закончили"))
    : null;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    const startDate = resolveLocalInput(start, feeding?.start_at ?? null);
    if (!startDate) {
      setError(t("Укажите, когда началось кормление"));
      return;
    }
    if (startDate.getTime() > Date.now() + 60_000) {
      setError(t("Время начала в будущем"));
      return;
    }

    let endDate: Date | null = null;
    if (end) {
      endDate = resolveLocalInput(end, feeding?.end_at ?? null);
      if (!endDate) {
        setError(t("Не удалось разобрать время окончания"));
        return;
      }
      if (endDate <= startDate) {
        setError(t("Окончание должно быть позже начала"));
        return;
      }
      if (endDate.getTime() - startDate.getTime() > MAX_FEEDING_MS) {
        setError(t("Больше шести часов подряд — похоже на опечатку"));
        return;
      }
    }

    let amountMl: number | null = null;
    if (family === "bottle" && amount.trim() !== "") {
      const parsed = Number(amount.trim().replace(",", "."));
      if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 2000) {
        setError(t("Объём похож на опечатку"));
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
      ended_by: endDate ? (feeding?.ended_by ?? currentAuthor()) : null,
      amount_ml: amountMl,
      food: family === "solid" ? trimOrNull(food) : null,
      note: trimOrNull(note),
      updated_at: feeding?.updated_at ?? nowISO(),
      deleted: false,
      created_by: feeding?.created_by ?? null,
    };

    await save("feedings", record);
    onClose();
  }

  async function handleDelete() {
    if (!feeding) return;
    const id = feeding.id;
    await softDelete("feedings", id);
    onClose();
    showToast(t("Кормление удалено"), {
      label: t("Отменить"),
      run: () => restore("feedings", id),
    });
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={feeding ? t("Кормление") : t("Добавить кормление")}
      subtitle={feeding ? undefined : t("Пригодится, если забыли нажать вовремя")}
    >
      <form onSubmit={handleSubmit}>
        <DateTimeField label={t("Начало")} value={start} onChange={setStart} />
        <DateTimeField
          label={t("Окончание")}
          hint={end ? undefined : t("пусто — кормление идёт")}
          value={end}
          onChange={setEnd}
          defaultDate={start.slice(0, 10)}
        />

        <Field label={t("Чем кормили")}>
          {(id) => (
            <Segmented<Family>
              id={id}
              value={family}
              onChange={setFamily}
              ariaLabel={t("Чем кормили")}
              options={[
                { value: "breast", label: t("Грудь") },
                { value: "bottle", label: t("Бутылочка") },
                { value: "solid", label: t("Прикорм") },
              ]}
            />
          )}
        </Field>

        {family === "breast" && showSide && (
          <Field label={t("Сторона")}>
            {(id) => (
              <Segmented<Side>
                id={id}
                value={side}
                onChange={setSide}
                ariaLabel={t("Сторона")}
                options={[
                  { value: "left", label: t("Левая") },
                  { value: "right", label: t("Правая") },
                  { value: "any", label: t("Не важно") },
                ]}
              />
            )}
          </Field>
        )}

        {family === "bottle" && (
          <Field label={t("Объём")} hint={t("сколько съел")}>
            {(id) => (
              <TextInput
                id={id}
                inputMode="numeric"
                suffix={t("мл")}
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="120"
              />
            )}
          </Field>
        )}

        {family === "solid" && (
          <Field label={t("Что ели")}>
            {(id) => (
              <TextInput
                id={id}
                value={food}
                onChange={(event) => setFood(event.target.value)}
                placeholder={t("Например, тыквенное пюре")}
              />
            )}
          </Field>
        )}

        <Field label={t("Заметка")}>
          {(id) => (
            <Textarea
              id={id}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder={t("Необязательно")}
            />
          )}
        </Field>

        {error && (
          <p style={{ color: "var(--danger)", fontSize: 14 }}>{error}</p>
        )}

        <FormActions>
          {feeding ? (
            <Button variant="danger" onClick={handleDelete}>
              {t("Удалить")}
            </Button>
          ) : (
            <Button variant="secondary" onClick={onClose}>
              {t("Отмена")}
            </Button>
          )}
          <Button type="submit" variant="primary">
            {t("Сохранить")}
          </Button>
        </FormActions>

        {who && <p className={styles.people}>{who}</p>}
      </form>
    </Sheet>
  );
}
