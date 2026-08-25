import type { CSSProperties } from "react";
import { Button } from "../../components/ui/Button";
import { Icon } from "../../components/ui/Icon";
import { useLive } from "../../data/hooks";
import {
  currentAuthor,
  listByChild,
  newId,
  nowISO,
  save,
} from "../../data/repo";
import type { Feeding } from "../../data/types";
import { findActive, suggestKind } from "./feedingUtils";

const NO_FEEDINGS: Feeding[] = [];

const TONE = {
  ["--tone" as string]: "var(--feeding)",
  ["--tone-soft" as string]: "var(--feeding-soft)",
} as CSSProperties;

export function FeedingButton({ childId }: { childId: string }) {
  const { data } = useLive(
    async () => await listByChild("feedings", childId),
    [childId],
  );
  const feedings = data ?? NO_FEEDINGS;
  const active = findActive(feedings);

  async function start() {
    const record: Feeding = {
      id: newId(),
      child_id: childId,
      start_at: new Date().toISOString(),
      end_at: null,
      kind: suggestKind(feedings),
      ended_by: null,
      amount_ml: null,
      food: null,
      note: null,
      updated_at: nowISO(),
      deleted: false,
      created_by: null,
    };
    await save("feedings", record);
  }

  async function stop() {
    if (!active) return;
    await save("feedings", {
      ...active,
      end_at: new Date().toISOString(),
      ended_by: currentAuthor(),
    });
  }

  if (active) {
    return (
      <Button size="lg" variant="soft" style={TONE} onClick={stop}>
        <Icon name="stop" size={17} />
        Доел
      </Button>
    );
  }

  return (
    <Button size="lg" variant="secondary" style={TONE} onClick={start}>
      <Icon name="bottle" size={17} />
      Кормлю
    </Button>
  );
}
