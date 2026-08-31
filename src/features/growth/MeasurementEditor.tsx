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
import { Sheet } from "../../components/ui/Sheet";
import { newId, nowISO, restore, save, softDelete } from "../../data/repo";
import { showToast } from "../../components/ui/toast";
import type { Measurement } from "../../data/types";
import { trimOrNull } from "../../lib/parse";
import { resolveLocalInput, toLocalInputValue } from "../../lib/time";
import { METRICS, METRIC_ORDER } from "./growthUtils";

interface MeasurementEditorProps {
  open: boolean;
  onClose: () => void;
  childId: string;
  measurement?: Measurement;
}

export function MeasurementEditor({
  open,
  onClose,
  childId,
  measurement,
}: MeasurementEditorProps) {
  const [at, setAt] = useState(
    toLocalInputValue(measurement?.measured_at ?? new Date()),
  );
  const [weight, setWeight] = useState(
    METRICS.weight.toInput(measurement?.weight_g ?? null),
  );
  const [height, setHeight] = useState(
    METRICS.height.toInput(measurement?.height_mm ?? null),
  );
  const [head, setHead] = useState(
    METRICS.head.toInput(measurement?.head_mm ?? null),
  );
  const [note, setNote] = useState(measurement?.note ?? "");
  const [error, setError] = useState<string | null>(null);

  const values = { weight, height, head };
  const setters = { weight: setWeight, height: setHeight, head: setHead };

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    const when = resolveLocalInput(at, measurement?.measured_at ?? null);
    if (!when) {
      setError(t("Укажите дату измерения"));
      return;
    }
    if (when.getTime() > Date.now() + 60_000) {
      setError(t("Дата измерения в будущем"));
      return;
    }

    const weightG = METRICS.weight.fromInput(weight);
    const heightMm = METRICS.height.fromInput(height);
    const headMm = METRICS.head.fromInput(head);

    if (weightG === null && heightMm === null && headMm === null) {
      setError(t("Заполните хотя бы одно значение"));
      return;
    }
    if (weightG !== null && (weightG < 300 || weightG > 60_000)) {
      setError(t("Вес похож на опечатку"));
      return;
    }
    if (heightMm !== null && (heightMm < 200 || heightMm > 1500)) {
      setError(t("Рост похож на опечатку"));
      return;
    }
    if (headMm !== null && (headMm < 200 || headMm > 700)) {
      setError(t("Окружность головы похожа на опечатку"));
      return;
    }

    const record: Measurement = {
      id: measurement?.id ?? newId(),
      child_id: childId,
      measured_at: when.toISOString(),
      weight_g: weightG,
      height_mm: heightMm,
      head_mm: headMm,
      note: trimOrNull(note),
      updated_at: measurement?.updated_at ?? nowISO(),
      deleted: false,
      created_by: measurement?.created_by ?? null,
    };

    await save("measurements", record);
    onClose();
  }

  async function handleDelete() {
    if (!measurement) return;
    const id = measurement.id;
    await softDelete("measurements", id);
    onClose();
    showToast(t("Измерение удалено"), {
      label: t("Отменить"),
      run: () => restore("measurements", id),
    });
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={measurement ? t("Измерение") : t("Новое измерение")}
      subtitle={
        measurement
          ? undefined
          : t("Заполните то, что известно — остальное можно оставить пустым")
      }
    >
      <form onSubmit={handleSubmit}>
        <DateTimeField label={t("Когда измеряли")} value={at} onChange={setAt} />

        {METRIC_ORDER.map((key) => {
          const info = METRICS[key];
          return (
            <Field key={key} label={info.label}>
              {(id) => (
                <TextInput
                  id={id}
                  inputMode="decimal"
                  suffix={info.unit}
                  value={values[key]}
                  onChange={(event) => setters[key](event.target.value)}
                  placeholder={info.placeholder}
                />
              )}
            </Field>
          );
        })}

        <Field label={t("Заметка")} hint={t("Например, приём у педиатра")}>
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
          {measurement ? (
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
      </form>
    </Sheet>
  );
}
