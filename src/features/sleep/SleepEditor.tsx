import { t } from "../../lib/i18n";
import { useState, type FormEvent } from "react";
import { Button } from "../../components/ui/Button";
import { Field, FormActions, Textarea } from "../../components/ui/Form";
import { DateTimeField } from "../../components/ui/DateTimeField";
import { Segmented } from "../../components/ui/Segmented";
import { NightFeedingsFields } from "../feeding/NightFeedingsFields";
import { Sheet } from "../../components/ui/Sheet";
import { useRecordPeople } from "../../data/hooks";
import styles from "./SleepEditor.module.css";
import {
  currentAuthor,
  newId,
  nowISO,
  restore,
  save,
  softDelete,
} from "../../data/repo";
import { showToast } from "../../components/ui/toast";
import type {
  NightFeedingKind,
  SleepKind,
  SleepSession,
} from "../../data/types";
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
  const [nightCount, setNightCount] = useState(session?.night_feedings ?? 0);
  const [nightKind, setNightKind] = useState<NightFeedingKind>(
    session?.night_feeding_kind ?? "breast",
  );
  const [nightMl, setNightMl] = useState(
    session?.night_feeding_ml == null ? "" : String(session.night_feeding_ml),
  );
  const [error, setError] = useState<string | null>(null);
  const people = useRecordPeople();
  const who = session
    ? people(session.created_by, session.ended_by, t("уложили"), t("подняли"))
    : null;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    const startDate = resolveLocalInput(start, session?.start_at ?? null);
    if (!startDate) {
      setError(t("Укажите, когда малыш уснул"));
      return;
    }

    let endDate: Date | null = null;
    if (end) {
      endDate = resolveLocalInput(end, session?.end_at ?? null);
      if (!endDate) {
        setError(t("Не удалось разобрать время пробуждения"));
        return;
      }
      if (endDate <= startDate) {
        setError(t("Пробуждение должно быть позже засыпания"));
        return;
      }
      if (endDate.getTime() - startDate.getTime() > 24 * 3600 * 1000) {
        setError(t("Больше суток подряд — похоже на опечатку"));
        return;
      }
    }

    if (startDate.getTime() > Date.now() + 60_000) {
      setError(t("Время засыпания в будущем"));
      return;
    }

    let nightMlValue: number | null = null;
    if (kind === "night" && nightCount > 0 && nightKind === "bottle" && nightMl.trim()) {
      const parsed = Number(nightMl.trim().replace(",", "."));
      if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 2000) {
        setError(t("Объём ночного кормления похож на опечатку"));
        return;
      }
      nightMlValue = Math.round(parsed);
    }

    const record: SleepSession = {
      id: session?.id ?? newId(),
      child_id: childId,
      start_at: startDate.toISOString(),
      end_at: endDate ? endDate.toISOString() : null,
      kind,
      ended_by: endDate
        ? (session?.ended_by ?? currentAuthor())
        : null,
      night_feedings: kind === "night" ? nightCount : null,
      night_feeding_kind:
        kind === "night" && nightCount > 0 ? nightKind : null,
      night_feeding_ml:
        kind === "night" && nightCount > 0 && nightKind === "bottle"
          ? nightMlValue
          : null,
      no_feed_before: session?.no_feed_before ?? null,
      note: trimOrNull(note),
      updated_at: session?.updated_at ?? nowISO(),
      deleted: false,
      created_by: session?.created_by ?? null,
    };

    await save("sleep_sessions", record);
    onClose();
  }

  async function handleDelete() {
    if (!session) return;
    const id = session.id;
    await softDelete("sleep_sessions", id);
    onClose();
    showToast(t("Запись сна удалена"), {
      label: t("Отменить"),
      run: () => restore("sleep_sessions", id),
    });
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={session ? t("Запись сна") : t("Добавить сон")}
      subtitle={
        session ? undefined : t("Пригодится, если забыли нажать кнопку вовремя")
      }
    >
      <form onSubmit={handleSubmit}>
        <DateTimeField label={t("Уснул")} value={start} onChange={setStart} />
        <DateTimeField
          label={t("Проснулся")}
          hint={end ? undefined : t("пусто — сон ещё идёт")}
          value={end}
          onChange={setEnd}
          defaultDate={start.slice(0, 10)}
        />

        <Field label={t("Тип")}>
          {(id) => (
            <Segmented<SleepKind>
              id={id}
              value={kind}
              onChange={setKind}
              ariaLabel={t("Тип сна")}
              options={[
                { value: "nap", label: t("Дневной") },
                { value: "night", label: t("Ночной") },
              ]}
            />
          )}
        </Field>

        {kind === "night" && (
          <NightFeedingsFields
            min={0}
            countLabel={t("Кормлений за ночь")}
            count={nightCount}
            onCount={setNightCount}
            kind={nightKind}
            onKind={setNightKind}
            amount={nightMl}
            onAmount={setNightMl}
          />
        )}

        <Field label={t("Заметка")} hint={t("Как засыпал, что помогло")}>
          {(id) => (
            <Textarea
              id={id}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t("Необязательно")}
            />
          )}
        </Field>

        {error && (
          <p style={{ color: "var(--danger)", fontSize: 14 }}>{error}</p>
        )}

        <FormActions>
          {session ? (
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
