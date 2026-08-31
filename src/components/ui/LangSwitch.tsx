import { t } from "../../lib/i18n";
import type { ReactElement } from "react";
import { useSettings } from "../../data/hooks";
import { updateSettings } from "../../data/settings";
import type { Lang } from "../../data/types";
import styles from "./LangSwitch.module.css";

/**
 * Флаги рисуем сами, а не эмодзи: эмодзи-флаги не отображаются в Windows и
 * по-разному выглядят на телефоне и в браузере.
 */
function UnionJack() {
  return (
    <svg viewBox="0 0 60 40" aria-hidden="true" focusable="false">
      <rect width="60" height="40" fill="#012169" />
      <path d="M0 0 60 40M60 0 0 40" stroke="#fff" strokeWidth="8" />
      <path d="M0 0 60 40M60 0 0 40" stroke="#C8102E" strokeWidth="4" />
      <path d="M30 0V40M0 20H60" stroke="#fff" strokeWidth="13" />
      <path d="M30 0V40M0 20H60" stroke="#C8102E" strokeWidth="7" />
    </svg>
  );
}

function Tricolour() {
  return (
    <svg viewBox="0 0 60 40" aria-hidden="true" focusable="false">
      <rect width="60" height="40" fill="#fff" />
      <rect y="13.33" width="60" height="13.34" fill="#0039A6" />
      <rect y="26.67" width="60" height="13.33" fill="#D52B1E" />
    </svg>
  );
}

const FLAGS: Record<Lang, { flag: () => ReactElement; label: string }> = {
  en: { flag: UnionJack, label: "English" },
  // Каждый язык подписан на себе самом, как принято у переключателей:
  // «Русский» не превращается в «Russian», когда интерфейс английский.
  ru: { flag: Tricolour, label: "Русский" },
};

export function LangSwitch({ className }: { className?: string }) {
  const { language } = useSettings();

  return (
    <div
      className={[styles.group, className ?? ""].filter(Boolean).join(" ")}
      role="group"
      aria-label={t("Язык")}
    >
      {(Object.keys(FLAGS) as Lang[]).map((code) => {
        const { flag: Flag, label } = FLAGS[code];
        const active = language === code;
        return (
          <button
            key={code}
            type="button"
            className={`${styles.flag} ${active ? styles.active : ""}`}
            aria-label={label}
            aria-pressed={active}
            onClick={() => updateSettings({ language: code })}
          >
            <Flag />
          </button>
        );
      })}
    </div>
  );
}
