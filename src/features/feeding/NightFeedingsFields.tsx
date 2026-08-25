import { Field, TextInput } from "../../components/ui/Form";
import { Segmented } from "../../components/ui/Segmented";
import type { NightFeedingKind } from "../../data/types";
import { plural } from "../../lib/time";
import styles from "./NightFeedingsSheet.module.css";

const MAX_COUNT = 12;

interface NightFeedingsFieldsProps {
  min: 0 | 1;
  count: number;
  onCount: (value: number) => void;
  kind: NightFeedingKind;
  onKind: (value: NightFeedingKind) => void;
  amount: string;
  onAmount: (value: string) => void;
  countLabel?: string;
}

export function NightFeedingsFields({
  min,
  count,
  onCount,
  kind,
  onKind,
  amount,
  onAmount,
  countLabel = "Сколько раз",
}: NightFeedingsFieldsProps) {
  return (
    <>
      <Field label={countLabel}>
        {() => (
          <div className={styles.stepper}>
            <button
              type="button"
              className={styles.step}
              disabled={count <= min}
              aria-label="Меньше"
              onClick={() => onCount(count - 1)}
            >
              −
            </button>
            <span className={`${styles.count} tnum`}>
              {count === 0
                ? "не было"
                : `${count} ${plural(count, ["раз", "раза", "раз"])}`}
            </span>
            <button
              type="button"
              className={styles.step}
              disabled={count >= MAX_COUNT}
              aria-label="Больше"
              onClick={() => onCount(count + 1)}
            >
              +
            </button>
          </div>
        )}
      </Field>

      {count > 0 && (
        <Field label="Чем кормили">
          {(id) => (
            <Segmented<NightFeedingKind>
              id={id}
              value={kind}
              onChange={onKind}
              ariaLabel="Чем кормили"
              options={[
                { value: "breast", label: "Грудь" },
                { value: "bottle", label: "Бутылочка" },
                { value: "solid", label: "Прикорм" },
              ]}
            />
          )}
        </Field>
      )}

      {count > 0 && kind === "bottle" && (
        <Field label="По сколько мл" hint="за одно кормление, если помните">
          {(id) => (
            <TextInput
              id={id}
              inputMode="numeric"
              suffix="мл"
              value={amount}
              onChange={(event) => onAmount(event.target.value)}
              placeholder="90"
            />
          )}
        </Field>
      )}
    </>
  );
}
