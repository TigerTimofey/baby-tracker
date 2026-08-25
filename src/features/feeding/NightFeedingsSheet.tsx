import { parseISO } from "date-fns";
import { useState } from "react";
import { Button } from "../../components/ui/Button";
import { FormActions } from "../../components/ui/Form";
import { Sheet } from "../../components/ui/Sheet";
import { save } from "../../data/repo";
import type { NightFeedingKind, SleepSession } from "../../data/types";
import { formatDuration, formatTime } from "../../lib/time";
import { NightFeedingsFields } from "./NightFeedingsFields";
import styles from "./NightFeedingsSheet.module.css";

interface NightFeedingsSheetProps {
  open: boolean;
  onClose: () => void;
  session: SleepSession;
}

export function NightFeedingsSheet({
  open,
  onClose,
  session,
}: NightFeedingsSheetProps) {
  const [count, setCount] = useState(session.night_feedings || 2);
  const [kind, setKind] = useState<NightFeedingKind>(
    session.night_feeding_kind ?? "breast",
  );
  const [amount, setAmount] = useState(
    session.night_feeding_ml == null ? "" : String(session.night_feeding_ml),
  );
  const [error, setError] = useState<string | null>(null);

  const from = parseISO(session.start_at).getTime();
  const to = session.end_at ? parseISO(session.end_at).getTime() : from;

  async function store(feedings: number) {
    let amountMl: number | null = null;
    if (feedings > 0 && kind === "bottle" && amount.trim() !== "") {
      const parsed = Number(amount.trim().replace(",", "."));
      if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 2000) {
        setError("Объём похож на опечатку");
        return;
      }
      amountMl = Math.round(parsed);
    }

    await save("sleep_sessions", {
      ...session,
      night_feedings: feedings,
      night_feeding_kind: feedings > 0 ? kind : null,
      night_feeding_ml: feedings > 0 ? amountMl : null,
    });
    onClose();
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Были кормления за ночь?"
      subtitle={`Сон записан одним куском: ${formatTime(session.start_at)} → ${
        session.end_at ? formatTime(session.end_at) : ""
      }, ${formatDuration(to - from)}`}
    >
      <p className={styles.intro}>
        Если малыш просыпался поесть — отметьте сколько раз и чем. Время не
        нужно, важны количество и чем кормили.
      </p>

      <NightFeedingsFields
        min={1}
        count={count}
        onCount={setCount}
        kind={kind}
        onKind={setKind}
        amount={amount}
        onAmount={setAmount}
      />

      {error && <p style={{ color: "var(--danger)", fontSize: 14 }}>{error}</p>}

      <FormActions>
        <Button variant="secondary" onClick={() => void store(0)}>
          Не было
        </Button>
        <Button variant="primary" onClick={() => void store(count)}>
          Сохранить
        </Button>
      </FormActions>

      <p className={styles.note}>
        Отметка хранится в самой записи сна и попадает в статистику. Отдельных
        кормлений с выдуманным временем не создаётся.
      </p>
    </Sheet>
  );
}
