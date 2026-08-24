import { useState, type CSSProperties } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useActiveChild, useNow } from "../data/hooks";
import { updateSettings } from "../data/settings";
import { ChildForm } from "../features/children/ChildForm";
import { ageOf, birthMoment, formatAge } from "../lib/time";
import { SyncBadge } from "./SyncBadge";
import { Button } from "./ui/Button";
import { Icon, type IconName } from "./ui/Icon";
import { Sheet } from "./ui/Sheet";
import styles from "./AppShell.module.css";

interface Tab {
  to: string;
  label: string;
  icon: IconName;
  tone: string;
}

const TABS: Tab[] = [
  { to: "/sleep", label: "Сон", icon: "moon", tone: "sleep" },
  { to: "/growth", label: "Рост", icon: "growth", tone: "growth" },
  { to: "/milestones", label: "Вехи", icon: "star", tone: "milestone" },
  { to: "/stats", label: "Статистика", icon: "stats", tone: "stats" },
];

function toneForPath(pathname: string): string {
  return TABS.find((tab) => pathname.startsWith(tab.to))?.tone ?? "sleep";
}

export function AppShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const { child, children } = useActiveChild();
  const now = useNow(30_000);

  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(false);

  const tone = toneForPath(location.pathname);
  const toneStyle = {
    "--tone": `var(--${tone})`,
    "--tone-soft": `var(--${tone}-soft)`,
  } as CSSProperties;

  const age = child
    ? formatAge(ageOf(birthMoment(child.birth_date, child.birth_time), new Date(now)))
    : "";

  return (
    <div className={styles.app} style={toneStyle}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <button
            type="button"
            className={styles.childButton}
            onClick={() => setSwitcherOpen(true)}
          >
            <span className={styles.avatar}>
              {child ? child.name.slice(0, 1).toUpperCase() : "?"}
            </span>
            <span className={styles.childText}>
              <span className={styles.childName}>
                {child?.name ?? "Малыш"}
                <Icon name="chevron-down" size={15} />
              </span>
              <span className={styles.childAge}>{age}</span>
            </span>
          </button>

          <span className={styles.spacer} />
          <SyncBadge />
          <button
            type="button"
            className={styles.iconButton}
            onClick={() => navigate("/settings")}
            aria-label="Настройки"
          >
            <Icon name="settings" size={21} />
          </button>
        </div>
      </header>

      <main className={styles.main}>
        <Outlet />
      </main>

      <nav className={styles.nav}>
        <div className={styles.navInner}>
          {TABS.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              className={({ isActive }) =>
                [styles.navItem, isActive ? styles.navItemActive : ""]
                  .filter(Boolean)
                  .join(" ")
              }
              style={{ ["--navTone" as string]: `var(--${tab.tone})` }}
            >
              <Icon name={tab.icon} size={22} />
              {tab.label}
            </NavLink>
          ))}
        </div>
      </nav>

      <Sheet
        open={switcherOpen}
        onClose={() => setSwitcherOpen(false)}
        title="Малыши"
      >
        <div className={styles.childList}>
          {children.map((item) => {
            const itemAge = formatAge(
              ageOf(birthMoment(item.birth_date, item.birth_time), new Date(now)),
            );
            const active = item.id === child?.id;
            return (
              <button
                key={item.id}
                type="button"
                className={[
                  styles.childRow,
                  active ? styles.childRowActive : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => {
                  updateSettings({ activeChildId: item.id });
                  setSwitcherOpen(false);
                }}
              >
                <span className={styles.avatar}>
                  {item.name.slice(0, 1).toUpperCase()}
                </span>
                <span>
                  <span className={styles.childRowName}>{item.name}</span>
                  <br />
                  <span className={styles.childRowAge}>{itemAge}</span>
                </span>
              </button>
            );
          })}
        </div>

        <div className={styles.sheetActions}>
          <Button
            variant="secondary"
            onClick={() => {
              setEditing(true);
              setFormOpen(true);
              setSwitcherOpen(false);
            }}
            disabled={!child}
          >
            <Icon name="pencil" size={17} />
            Изменить
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              setEditing(false);
              setFormOpen(true);
              setSwitcherOpen(false);
            }}
          >
            <Icon name="plus" size={17} />
            Добавить
          </Button>
        </div>
      </Sheet>

      {formOpen && (
        <ChildForm

          key={editing ? `edit-${child?.id}` : "new"}
          open={formOpen}
          onClose={() => setFormOpen(false)}
          child={editing && child ? child : undefined}
          canDelete={editing && children.length > 1}
        />
      )}
    </div>
  );
}
