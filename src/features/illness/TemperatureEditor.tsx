import { locale, t } from "../../lib/i18n";
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
    reading ? reading.celsius.toLocaleString(locale()) : "",
  );
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    const when = resolveLocalInput(at, reading?.measured_at ?? null);
    if (!when) {
      setError(t("Укажите, когда измеряли"));
      return;
    }
    if (when.getTime() > Date.now() + 60_000) {
      setError(t("Время в будущем"));
      return;
    }

    // Пустую строку Number() превращает в ноль, а не в NaN, поэтому без
    // отдельной проверки родитель получал бы «похоже на опечатку» вместо
    // внятного «введите температуру».
    const raw = value.trim();
    if (raw === "") {
      setError(t("Введите температуру"));
      return;
    }
    const parsed = Number(raw.replace(",", "."));
    if (!Number.isFinite(parsed)) {
      setError(t("Введите температуру, например 37,4"));
      return;
    }
    if (parsed < MIN_C || parsed > MAX_C) {
      setError(t("Похоже на опечатку — ждём от {0} до {1} °C", [MIN_C, MAX_C]));
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
    showToast(t("Замер удалён"), {
      label: t("Вернуть"),
      run: () => void restore("temperatures", reading.id),
    });
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={reading ? t("Замер температуры") : t("Записать температуру")}
    >
      <form onSubmit={handleSubmit}>
        <DateTimeField label={t("Когда")} value={at} onChange={setAt} />

        <Field label={t("Способ")} hint={t("жар считаем от {0} °C", [feverThreshold(method).toLocaleString(locale(), { minimumFractionDigits: 1 })])}>
          {(id) => (
            <Segmented<TempMethod>
              id={id}
              value={method}
              onChange={setMethod}
              ariaLabel={t("Способ измерения")}
              options={METHODS.map((item) => ({
                value: item,
                label: methodLabel(item),
              }))}
            />
          )}
        </Field>

        <Field label={t("Температура")}>
          {(id) => (
            <TextInput
              id={id}
              inputMode="decimal"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder={t("37,4")}
              suffix="°C"
              autoFocus={!reading}
            />
          )}
        </Field>

        {error && <p style={{ color: "var(--danger)", fontSize: 14 }}>{error}</p>}

        <FormActions>
          {reading ? (
            <Button type="button" variant="ghost" onClick={handleDelete}>
              {t("Удалить")}
            </Button>
          ) : (
            <Button type="button" variant="secondary" onClick={onClose}>
              {t("Отмена")}
            </Button>
          )}
          <Button type="submit" variant="primary">
            {t("Сохранить")}
          </Button>
        </FormActions>
      </form>
    </Sheet>
  );
}
