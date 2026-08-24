import { useState, type FormEvent } from "react";
import { Button } from "../../components/ui/Button";
import { Field, FormActions, Textarea } from "../../components/ui/Form";
import { DateTimeField } from "../../components/ui/DateTimeField";
import { Segmented } from "../../components/ui/Segmented";
import { Sheet } from "../../components/ui/Sheet";
import { newId, nowISO, save, softDelete } from "../../data/repo";
import type { SleepKind, SleepSession } from "../../data/types";
import { trimOrNull } from "../../lib/parse";
import { resolveLocalInput, toLocalInputValue } from "../../lib/time";
import { guessKind } from "./sleepUtils";

interface SleepEditorProps {
  open: boolean;
  onClose: () => void;
  childId: string;
  session?: SleepSession;
}

export function SleepEditor({
  open,
  onClose,
  childId,
  session,
}: SleepEditorProps) {
  const now = new Date();

  const [start, setStart] = useState(
    toLocalInputValue(session?.start_at ?? now),
  );
  const [end, setEnd] = useState(
    session?.end_at ? toLocalInputValue(session.end_at) : "",
  );
  const [kind, setKind] = useState<SleepKind>(session?.kind ?? guessKind(now));
  const [note, setNote] = useState(session?.note ?? "");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    const startDate = resolveLocalInput(start, session?.start_at ?? null);
    if (!startDate) {
      setError("Укажите, когда малыш уснул");
      return;
    }

    let endDate: Date | null = null;
    if (end) {
      endDate = resolveLocalInput(end, session?.end_at ?? null);
      if (!endDate) {
        setError("Не удалось разобрать время пробуждения");
        return;
      }
      if (endDate <= startDate) {
        setError("Пробуждение должно быть позже засыпания");
        return;
      }
      if (endDate.getTime() - startDate.getTime() > 24 * 3600 * 1000) {
        setError("Больше суток подряд — похоже на опечатку");
        return;
      }
    }

    if (startDate.getTime() > Date.now() + 60_000) {
      setError("Время засыпания в будущем");
      return;
    }

    const record: SleepSession = {
      id: session?.id ?? newId(),
      child_id: childId,
      start_at: startDate.toISOString(),
      end_at: endDate ? endDate.toISOString() : null,
      kind,
      note: trimOrNull(note),
      updated_at: session?.updated_at ?? nowISO(),
      deleted: false,
    };

    await save("sleep_sessions", record);
    onClose();
  }

  async function handleDelete() {
    if (!session) return;
    if (!window.confirm("Удалить эту запись сна?")) return;
    await softDelete("sleep_sessions", session.id);
    onClose();
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={session ? "Запись сна" : "Добавить сон"}
      subtitle={
        session ? undefined : "Пригодится, если забыли нажать кнопку вовремя"
      }
    >
      <form onSubmit={handleSubmit}>
        <DateTimeField label="Уснул" value={start} onChange={setStart} />
        <DateTimeField
          label="Проснулся"
          hint={end ? undefined : "пусто — сон ещё идёт"}
          value={end}
          onChange={setEnd}
        />

        <Field label="Тип">
          {(id) => (
            <Segmented<SleepKind>
              id={id}
              value={kind}
              onChange={setKind}
              ariaLabel="Тип сна"
              options={[
                { value: "nap", label: "Дневной" },
                { value: "night", label: "Ночной" },
              ]}
            />
          )}
        </Field>

        <Field label="Заметка" hint="Как засыпал, что помогло">
          {(id) => (
            <Textarea
              id={id}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Необязательно"
            />
          )}
        </Field>

        {error && (
          <p style={{ color: "var(--danger)", fontSize: 14 }}>{error}</p>
        )}

        <FormActions>
          {session ? (
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
