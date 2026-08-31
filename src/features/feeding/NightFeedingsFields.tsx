import { pluralOf, t } from "../../lib/i18n";
import { Field, TextInput } from "../../components/ui/Form";
import { Segmented } from "../../components/ui/Segmented";
import type { NightFeedingKind } from "../../data/types";

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
  countLabel = t("Сколько раз"),
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
              aria-label={t("Меньше")}
              onClick={() => onCount(count - 1)}
            >
              −
            </button>
            <span className={`${styles.count} tnum`}>
              {count === 0
                ? t("не было")
                : `${count} ${pluralOf(count, "раз")}`}
            </span>
            <button
              type="button"
              className={styles.step}
              disabled={count >= MAX_COUNT}
              aria-label={t("Больше")}
              onClick={() => onCount(count + 1)}
            >
              +
            </button>
          </div>
        )}
      </Field>

      {count > 0 && (
        <Field label={t("Чем кормили")}>
          {(id) => (
            <Segmented<NightFeedingKind>
              id={id}
              value={kind}
              onChange={onKind}
              ariaLabel={t("Чем кормили")}
              options={[
                { value: "breast", label: t("Грудь") },
                { value: "bottle", label: t("Бутылочка") },
                { value: "solid", label: t("Прикорм") },
              ]}
            />
          )}
        </Field>
      )}

      {count > 0 && kind === "bottle" && (
        <Field label={t("По сколько мл")} hint={t("за одно кормление, если помните")}>
          {(id) => (
            <TextInput
              id={id}
              inputMode="numeric"
              suffix={t("мл")}
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
