import { t } from "../../lib/i18n";
import { Sheet } from "../../components/ui/Sheet";
import { JoinFamilyForm } from "./JoinFamilyForm";

interface JoinFamilySheetProps {
  open: boolean;
  onClose: () => void;
}

export function JoinFamilySheet({ open, onClose }: JoinFamilySheetProps) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t("Присоединиться к семье")}
      subtitle={t("Код смотрите на телефоне второго родителя: шестерёнка → Синхронизация")}
    >
      <JoinFamilyForm autoFocus onJoined={onClose} />
    </Sheet>
  );
}
