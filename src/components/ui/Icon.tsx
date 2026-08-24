/* ---------------------------------------------------------------
   Иконки — встроенные SVG.

   Отдельная библиотека иконок ради полутора десятков штук не нужна:
   так меньше вес приложения и полный контроль над начертанием.
   --------------------------------------------------------------- */

export type IconName =
  | "moon"
  | "sun"
  | "growth"
  | "star"
  | "stats"
  | "settings"
  | "plus"
  | "play"
  | "stop"
  | "check"
  | "trash"
  | "pencil"
  | "close"
  | "cloud"
  | "cloud-off"
  | "baby"
  | "chevron-left"
  | "chevron-right"
  | "chevron-down"
  | "bottle"
  | "clock";

const PATHS: Record<IconName, React.ReactNode> = {
  moon: <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a7.5 7.5 0 1 0 10.5 10.5Z" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  ),
  growth: (
    <>
      <path d="M3 20h18" />
      <path d="M6 20V9m6 11V4m6 16v-7" />
    </>
  ),
  star: (
    <path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1.1 5.9-5.3-2.9-5.3 2.9 1.1-5.9L3.5 9.7l5.9-.8Z" />
  ),
  stats: (
    <>
      <path d="M3 3v18h18" />
      <path d="m7 14 3.5-4 3 3L20 6" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1Z" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  play: <path d="M8 5.5v13l11-6.5Z" />,
  stop: <rect x="6" y="6" width="12" height="12" rx="2.5" />,
  check: <path d="m5 13 4.5 4.5L19 7" />,
  trash: (
    <>
      <path d="M4 7h16M10 11v6m4-6v6" />
      <path d="M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" />
      <path d="M9 7V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V7" />
    </>
  ),
  pencil: (
    <>
      <path d="M4 20h4L20 8a2.8 2.8 0 0 0-4-4L4 16Z" />
      <path d="m14.5 5.5 4 4" />
    </>
  ),
  close: <path d="M6 6l12 12M18 6 6 18" />,
  cloud: (
    <path d="M7 19a4 4 0 0 1-.4-8A6 6 0 0 1 18 9.3 3.9 3.9 0 0 1 17.5 19Z" />
  ),
  "cloud-off": (
    <>
      <path d="M4 4l16 16" />
      <path d="M7 19a4 4 0 0 1-.4-8 5.6 5.6 0 0 1 1.2-2.6M11 6.3A6 6 0 0 1 18 9.3a3.9 3.9 0 0 1 1.6 7" />
    </>
  ),
  baby: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M10.5 7.5h.01M13.5 7.5h.01" />
      <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
    </>
  ),
  "chevron-left": <path d="m14.5 6-6 6 6 6" />,
  "chevron-right": <path d="m9.5 6 6 6-6 6" />,
  "chevron-down": <path d="m6 9.5 6 6 6-6" />,
  bottle: (
    <>
      <path d="M10 3h4v3l1.5 2v11a2 2 0 0 1-2 2h-3a2 2 0 0 1-2-2V8L10 6Z" />
      <path d="M8.5 12h7" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5.2l3.2 2" />
    </>
  ),
};

/** Иконки, которые выглядят лучше залитыми, а не обведёнными. */
const FILLED = new Set<IconName>(["play", "star", "moon", "stop", "cloud"]);

interface IconProps {
  name: IconName;
  size?: number;
  className?: string;
}

export function Icon({ name, size = 22, className }: IconProps) {
  const filled = FILLED.has(name);
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke={filled ? "none" : "currentColor"}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}
