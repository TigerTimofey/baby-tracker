import { t } from "../../lib/i18n";
import { useState, type FormEvent } from "react";
import { Button } from "../../components/ui/Button";
import { DateTimeField } from "../../components/ui/DateTimeField";
import { Field, FormActions, TextInput } from "../../components/ui/Form";
import { Segmented } from "../../components/ui/Segmented";
import { Sheet } from "../../components/ui/Sheet";
import { showToast } from "../../components/ui/toast";
import { newId, nowISO, restore, save, softDelete } from "../../data/repo";
import type { DoseUnit, Medicine } from "../../data/types";
import { resolveLocalInput, toLocalInputValue } from "../../lib/time";
import {
  DEFAULT_PRESET,
  PRESETS,
  UNITS,
  formatDose,
  presetForName,
  presetInfo,
  unitLabel,
  type Preset,
} from "./medUtils";

const MAX_AMOUNT = 10_000;
const CUSTOM = "custom";

interface MedicineEditorProps {
  open: boolean;
  onClose: () => void;
  childId: string;
  dose?: Medicine;
}

export function MedicineEditor({
  open,
  onClose,
  childId,
  dose,
}: MedicineEditorProps) {
  const [at, setAt] = useState(
    toLocalInputValue(dose?.given_at ?? new Date()),
  );
  const start = dose ? presetForName(dose.name) : DEFAULT_PRESET;
  const [preset, setPreset] = useState<Preset>(start);
  const [name, setName] = useState(dose?.name ?? presetInfo(start).name);
  // Пустая строка — «ничего не выбрано»: дозу не подставляем сами, её
  // называет родитель. CUSTOM показывает поле для ввода вручную.
  const [choice, setChoice] = useState(() => {
    if (!dose || dose.amount === null) return "";
    return presetInfo(start).doses.includes(dose.amount)
      ? String(dose.amount)
      : CUSTOM;
  });
  const [amount, setAmount] = useState(
    dose?.amount == null ? "" : formatDose(dose.amount),
  );
  const [unit, setUnit] = useState<DoseUnit>(
    dose?.unit ?? presetInfo(start).unit,
  );
  const [error, setError] = useState<string | null>(null);

  function choosePreset(next: Preset) {
    setPreset(next);
    const info = presetInfo(next);
    // Единицы у препаратов разные, поэтому кнопка сразу ставит нужные.
    // Это подсказка, а не запрет: переключатель ниже остаётся рабочим.
    setUnit(info.unit);
    setName(next === "other" ? "" : info.name);
    // Дозировки у препаратов разные, старый выбор к новому не относится.
    setChoice("");
    setAmount("");
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    const when = resolveLocalInput(at, dose?.given_at ?? null);
    if (!when) {
      setError(t("Укажите, когда дали"));
      return;
    }
    if (when.getTime() > Date.now() + 60_000) {
      setError(t("Время в будущем"));
      return;
    }

    const title = preset === "other" ? name.trim() : presetInfo(preset).name;
    if (!title) {
      setError(t("Напишите, что дали"));
      return;
    }

    const doses = presetInfo(preset).doses;
    const typed = doses.length === 0 || choice === CUSTOM;

    let value: number;
    if (typed) {
      const raw = amount.trim();
      if (raw === "") {
        setError(t("Укажите, сколько дали"));
        return;
      }
      const parsed = Number(raw.replace(",", "."));
      if (!Number.isFinite(parsed) || parsed <= 0 || parsed > MAX_AMOUNT) {
        setError(t("Количество похоже на опечатку"));
        return;
      }
      value = Math.round(parsed * 100) / 100;
    } else {
      if (choice === "") {
        setError(t("Выберите, сколько дали"));
        return;
      }
      value = Number(choice);
    }

    await save("medicines", {
      id: dose?.id ?? newId(),
      child_id: childId,
      given_at: when.toISOString(),
      name: title,
      amount: value,
      unit,
      note: dose?.note ?? null,
      updated_at: nowISO(),
      deleted: false,
      created_by: dose?.created_by ?? null,
    });
    onClose();
  }

  async function handleDelete() {
    if (!dose) return;
    await softDelete("medicines", dose.id);
    onClose();
    showToast(t("Запись удалена"), {
      label: t("Вернуть"),
      run: () => void restore("medicines", dose.id),
    });
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={dose ? t("Лекарство") : t("Дать лекарство")}
    >
      <form onSubmit={handleSubmit}>
        <DateTimeField label={t("Когда")} value={at} onChange={setAt} />

        <Field label={t("Что дали")}>
          {(id) => (
            <Segmented<Preset>
              id={id}
              value={preset}
              onChange={choosePreset}
              ariaLabel={t("Что дали")}
              options={PRESETS.map((item) => ({
                value: item.id,
                label: item.label,
              }))}
            />
          )}
        </Field>

        {preset === "other" && (
          <Field label={t("Название")}>
            {(id) => (
              <TextInput
                id={id}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={t("Например, Виферон")}
                autoComplete="off"
                autoFocus
              />
            )}
          </Field>
        )}

        <Field label={t("Сколько")}>
          {(id) =>
            presetInfo(preset).doses.length > 0 ? (
              <Segmented
                id={id}
                value={choice}
                onChange={setChoice}
                ariaLabel={t("Сколько")}
                options={[
                  ...presetInfo(preset).doses.map((item) => ({
                    value: String(item),
                    label: `${formatDose(item)} ${unitLabel(unit)}`,
                  })),
                  { value: CUSTOM, label: t("Другое") },
                ]}
              />
            ) : (
              <TextInput
                id={id}
                inputMode="decimal"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder={t("2,5")}
                suffix={unitLabel(unit)}
              />
            )
          }
        </Field>

        {presetInfo(preset).doses.length > 0 && choice === CUSTOM && (
          <Field label={t("Своя дозировка")}>
            {(id) => (
              <TextInput
                id={id}
                inputMode="decimal"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder={formatDose(presetInfo(preset).doses[0])}
                suffix={unitLabel(unit)}
                autoFocus
              />
            )}
          </Field>
        )}

        {/* Когда доза выбрана кнопкой, единицы уже написаны на ней —
            второй переключатель был бы тем же самым дважды. */}
        {(choice === "" || choice === CUSTOM) && (
          <Field label={t("Единицы")}>
            {(id) => (
              <Segmented<DoseUnit>
                id={id}
                value={unit}
                onChange={setUnit}
                ariaLabel={t("Единицы")}
                options={UNITS.map((item) => ({
                  value: item,
                  label: unitLabel(item),
                }))}
              />
            )}
          </Field>
        )}

        {error && <p style={{ color: "var(--danger)", fontSize: 14 }}>{error}</p>}

        <FormActions>
          {dose ? (
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
