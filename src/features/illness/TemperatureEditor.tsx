import { useState, type FormEvent } from "react";
import { Button } from "../../components/ui/Button";
import { DateTimeField } from "../../components/ui/DateTimeField";
import { Field, FormActions, TextInput } from "../../components/ui/Form";
import { Segmented } from "../../components/ui/Segmented";
import { Sheet } from "../../components/ui/Sheet";
import { showToast } from "../../components/ui/toast";
import { newId, nowISO, restore, save, softDelete } from "../../data/repo";
import type { Temperature, TempMethod } from "../../data/types";
import { resolveLocalInput, toLocalInputValue } from "../../lib/time";
import {
  DEFAULT_METHOD,
  METHODS,
  feverThreshold,
  methodLabel,
} from "./tempUtils";

const MIN_C = 30;
const MAX_C = 43;

interface TemperatureEditorProps {
  open: boolean;
  onClose: () => void;
  childId: string;
  reading?: Temperature;
}

export function TemperatureEditor({
  open,
  onClose,
  childId,
  reading,
}: TemperatureEditorProps) {
  const [at, setAt] = useState(
    toLocalInputValue(reading?.measured_at ?? new Date()),
  );
  const [method, setMethod] = useState<TempMethod>(reading?.method ?? DEFAULT_METHOD);
  const [value, setValue] = useState(
    reading ? reading.celsius.toLocaleString("ru-RU") : "",
  );
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    const when = resolveLocalInput(at, reading?.measured_at ?? null);
    if (!when) {
      setError("Укажите, когда измеряли");
      return;
    }
    if (when.getTime() > Date.now() + 60_000) {
      setError("Время в будущем");
      return;
    }

    // Пустую строку Number() превращает в ноль, а не в NaN, поэтому без
    // отдельной проверки родитель получал бы «похоже на опечатку» вместо
    // внятного «введите температуру».
    const raw = value.trim();
    if (raw === "") {
      setError("Введите температуру");
      return;
    }
    const parsed = Number(raw.replace(",", "."));
    if (!Number.isFinite(parsed)) {
      setError("Введите температуру, например 37,4");
      return;
    }
    if (parsed < MIN_C || parsed > MAX_C) {
      setError(`Похоже на опечатку — ждём от ${MIN_C} до ${MAX_C} °C`);
      return;
    }

    const record: Temperature = {
      id: reading?.id ?? newId(),
      child_id: childId,
      measured_at: when.toISOString(),
      celsius: Math.round(parsed * 10) / 10,
      method,
      // Правка замера не воскрешает законченную болезнь: отметка остаётся.
      recovered_at: reading?.recovered_at ?? null,
      note: reading?.note ?? null,
      updated_at: nowISO(),
      deleted: false,
      created_by: reading?.created_by ?? null,
    };

    await save("temperatures", record);
    onClose();
  }

  async function handleDelete() {
    if (!reading) return;
    await softDelete("temperatures", reading.id);
    onClose();
    showToast("Замер удалён", {
      label: "Вернуть",
      run: () => void restore("temperatures", reading.id),
    });
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={reading ? "Замер температуры" : "Записать температуру"}
    >
      <form onSubmit={handleSubmit}>
        <DateTimeField label="Когда" value={at} onChange={setAt} />

        <Field label="Способ" hint={`жар считаем от ${feverThreshold(method).toLocaleString("ru-RU", { minimumFractionDigits: 1 })} °C`}>
          {(id) => (
            <Segmented<TempMethod>
              id={id}
              value={method}
              onChange={setMethod}
              ariaLabel="Способ измерения"
              options={METHODS.map((item) => ({
                value: item,
                label: methodLabel(item),
              }))}
            />
          )}
        </Field>

        <Field label="Температура">
          {(id) => (
            <TextInput
              id={id}
              inputMode="decimal"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder="37,4"
              suffix="°C"
              autoFocus={!reading}
            />
          )}
        </Field>

        {error && <p style={{ color: "var(--danger)", fontSize: 14 }}>{error}</p>}

        <FormActions>
          {reading ? (
            <Button type="button" variant="ghost" onClick={handleDelete}>
              Удалить
            </Button>
          ) : (
            <Button type="button" variant="secondary" onClick={onClose}>
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
