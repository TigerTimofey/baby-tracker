import { useState } from "react";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { Icon } from "../components/ui/Icon";
import { useActiveChild, useAuthorLabel, useLive, useNow } from "../data/hooks";
import { listByChild, save } from "../data/repo";
import type { Medicine, Temperature } from "../data/types";
import { FeverChart } from "../features/illness/FeverChart";
import { IllnessReport } from "../features/illness/IllnessReport";
import { MedicineEditor } from "../features/illness/MedicineEditor";
import { TemperatureEditor } from "../features/illness/TemperatureEditor";
import { doseLine, doseTimers, givenMs } from "../features/illness/medUtils";
import {
  currentSpell,
  feverThreshold,
  formatCelsius,
  highThreshold,
  levelOf,
  levelWord,
  methodLabel,
  sortedByTimeDesc,
  measuredMs,
  formatSpan,
  listSpells,
  spellEnd,
  type FeverSpell,
} from "../features/illness/tempUtils";
import {
  ageOf,
  birthMoment,
  formatAge,
  formatDayDate,
  formatDayLabel,
  formatDuration,
  formatTime,
  plural,
} from "../lib/time";
import styles from "./IllnessPage.module.css";

const NONE: Temperature[] = [];

/** Коротко: до двух лет месяцами, дальше годами — как о ребёнке и говорят. */
function shortAge(months: number): string {
  if (months < 24) return `${months} мес`;
  const years = Math.floor(months / 12);
  return `${years} ${plural(years, ["год", "года", "лет"])}`;
}
const NO_DOSES: Medicine[] = [];

type Entry =
  | { kind: "temp"; at: number; reading: Temperature }
  | { kind: "dose"; at: number; dose: Medicine };

export function IllnessPage() {
  const { child } = useActiveChild();
  const childId = child?.id;
  const now = useNow(60_000);
  const author = useAuthorLabel();
  const [tempOpen, setTempOpen] = useState(false);
  const [picked, setPicked] = useState<Temperature | null>(null);
  const [medOpen, setMedOpen] = useState(false);
  const [pickedDose, setPickedDose] = useState<Medicine | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [openPast, setOpenPast] = useState<string | null>(null);

  const { data } = useLive(
    async () => (childId ? await listByChild("temperatures", childId) : NONE),
    [childId],
  );
  const readings = data ?? NONE;

  const { data: doseData } = useLive(
    async () => (childId ? await listByChild("medicines", childId) : NO_DOSES),
    [childId],
  );
  const doses = doseData ?? NO_DOSES;

  if (!child) return null;

  const age = ageOf(birthMoment(child.birth_date, child.birth_time), new Date(now));
  const ageMonths = age.totalMonths;

  const spell = currentSpell(readings, now);
  const sorted = sortedByTimeDesc(readings);

  const timers = doseTimers(doses, now);

  const recoveredAt = spell?.recoveredAt ?? null;
  const allSpells = listSpells(readings);
  const pastSpells = spell ? allSpells.slice(1) : allSpells;

  /**
   * Лекарства делим по болезням: до отметки «поправился», а без неё — пока
   * приложение считает болезнь идущей, но не заходя в следующую.
   */
  function dosesOfSpell(index: number): Medicine[] {
    const sp = allSpells[index];
    const newer = index > 0 ? allSpells[index - 1] : null;
    const end = Math.min(
      spellEnd(sp),
      newer ? newer.since : Number.POSITIVE_INFINITY,
      now,
    );
    return doses.filter((dose) => {
      const at = givenMs(dose);
      return at >= sp.since && at <= end;
    });
  }

  const spellDoses = spell ? dosesOfSpell(0) : NO_DOSES;

  /** Конец болезни для показа: отметка родителя или последний замер. */
  const spellShownEnd = (sp: FeverSpell) =>
    sp.recoveredAt ?? measuredMs(sp.last);

  const rangeOf = (from: number, to: number) =>
    new Date(from).toDateString() === new Date(to).toDateString()
      ? formatDayDate(new Date(from))
      : `${formatDayDate(new Date(from))} — ${formatDayDate(new Date(to))}`;

  /**
   * Отметка живёт на последнем замере болезни: отдельная таблица ради одного
   * флага не нужна, а так конец болезни уезжает второму родителю сам.
   */
  async function finishSpell() {
    if (!spell) return;
    setConfirming(false);
    await save("temperatures", {
      ...spell.last,
      recovered_at: new Date().toISOString(),
    });
  }

  async function reopenSpell() {
    if (!spell) return;
    await save("temperatures", { ...spell.last, recovered_at: null });
  }

  const spellRange =
    spell === null || recoveredAt === null
      ? ""
      : `${rangeOf(spell.since, recoveredAt)}, отметили в ${formatTime(
          new Date(recoveredAt),
        )}`;

  const addButtons = (
    <div className={styles.actions}>
      <Button
        variant="primary"
        size="lg"
        onClick={() => {
          setPicked(null);
          setTempOpen(true);
        }}
      >
        <Icon name="thermometer" size={18} />
        Температура
      </Button>
      <Button
        variant="secondary"
        size="lg"
        onClick={() => {
          setPickedDose(null);
          setMedOpen(true);
        }}
      >
        <Icon name="bottle" size={18} />
        Лекарство
      </Button>
    </div>
  );

  const entries: Entry[] = [
    ...sorted.map(
      (reading): Entry => ({ kind: "temp", at: measuredMs(reading), reading }),
    ),
    ...doses.map((dose): Entry => ({ kind: "dose", at: givenMs(dose), dose })),
  ].sort((a, b) => b.at - a.at);

  /** Записи одной болезни: ими же считаются «Замеров» и «Лекарств» в итоге. */
  function entriesOf(sp: FeverSpell, list: Medicine[]): Entry[] {
    return [
      ...sp.readings.map(
        (reading): Entry => ({
          kind: "temp",
          at: measuredMs(reading),
          reading,
        }),
      ),
      ...list.map((dose): Entry => ({ kind: "dose", at: givenMs(dose), dose })),
    ].sort((a, b) => b.at - a.at);
  }

  /**
   * Одна и та же лента и в общем журнале, и внутри итога болезни: там она
   * показывает только свой период, но выглядеть должна одинаково.
   */
  function renderLog(list: Entry[]) {
    const days = new Map<string, Entry[]>();
    for (const entry of list) {
      const key = new Date(entry.at).toDateString();
      const bucket = days.get(key);
      if (bucket) bucket.push(entry);
      else days.set(key, [entry]);
    }

    return [...days.entries()].map(([key, group]) => (
      <div key={key} className={styles.day}>
        <div className={styles.dayHead}>
          <span className={styles.dayName}>
            {formatDayLabel(new Date(key))}
            {formatDayLabel(new Date(key)) !== formatDayDate(new Date(key)) && (
              <span className={styles.dayDate}>
                {formatDayDate(new Date(key))}
              </span>
            )}
          </span>
          <span className={styles.dayCount}>
            {group.length}{" "}
            {plural(group.length, ["запись", "записи", "записей"])}
          </span>
        </div>

        {group.map((entry) => {
          if (entry.kind === "dose") {
            const who = author(entry.dose.created_by);
            return (
              <button
                key={entry.dose.id}
                type="button"
                className={styles.row}
                onClick={() => {
                  setPickedDose(entry.dose);
                  setMedOpen(true);
                }}
              >
                <span className={`${styles.time} tnum`}>
                  {formatTime(entry.dose.given_at)}
                </span>
                <span className={styles.rowText}>
                  <span className={styles.rowMethod}>
                    {doseLine(entry.dose, true)}
                    {who ? ` · ${who}` : ""}
                  </span>
                  {entry.dose.note && (
                    <span className={styles.rowNote}>{entry.dose.note}</span>
                  )}
                </span>
                <span className={styles.doseRight}>
                  {(() => {
                    const timer = timers.get(entry.dose.id);
                    if (!timer) return null;
                    return timer.ready ? (
                      <span className={styles.ready}>можно давать</span>
                    ) : (
                      <span className={`${styles.timer} tnum`}>
                        {formatDuration(timer.readyAt - now)}
                      </span>
                    );
                  })()}
                  <span className={styles.pill}>лекарство</span>
                </span>
              </button>
            );
          }

          const reading = entry.reading;
          const who = author(reading.created_by);
          return (
            <button
              key={reading.id}
              type="button"
              className={styles.row}
              onClick={() => {
                setPicked(reading);
                setTempOpen(true);
              }}
            >
              <span className={`${styles.time} tnum`}>
                {formatTime(reading.measured_at)}
              </span>
              <span className={styles.rowText}>
                <span className={styles.rowMethod}>
                  {methodLabel(reading.method)}
                  {who ? ` · ${who}` : ""}
                </span>
                {reading.note && (
                  <span className={styles.rowNote}>{reading.note}</span>
                )}
              </span>
              <span
                className={`${styles.value} tnum ${styles[levelOf(reading, ageMonths)]}`}
              >
                {formatCelsius(reading.celsius)}
              </span>
            </button>
          );
        })}
      </div>
    ));
  }

  /** Всё об одном периоде: журнал, график и выгрузка — без лишних карточек. */
  const spellSections = (sp: FeverSpell, list: Medicine[]) => (
    <>
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Журнал</h3>
          <div className={styles.inlineLog}>{renderLog(entriesOf(sp, list))}</div>
        </div>

        {sp.readings.length >= 2 && (
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Как менялась температура</h3>
            <FeverChart
              readings={sp.readings}
              doses={list}
              ageMonths={ageMonths}
              now={now}
            />
          </div>
        )}

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Выгрузить для врача</h3>
        <IllnessReport
          child={child}
          readings={sp.readings}
          doses={list}
          ageMonths={ageMonths}
          age={formatAge(age)}
          now={now}
        />
      </div>
    </>
  );

  /**
   * Экран «болезни нет». Пока болезни нет, выбирать нечего: одна кнопка
   * заводит первый замер, с него болезнь и начинается.
   */
  const startCard = (lead: string) => (
    <Card title="Сейчас">
      <p className={styles.lead}>{lead}</p>
      <div className={styles.actions}>
        <Button
          variant="primary"
          size="lg"
          onClick={() => {
            setPicked(null);
            setTempOpen(true);
          }}
        >
          <Icon name="thermometer" size={18} />
          Заболел
        </Button>
      </div>
    </Card>
  );

  return (
    <>
      <h1 className="sr-only">Контроль болезни</h1>

      <div className={styles.stack}>
        {confirming && spell ? (
          <Card title="Сейчас">
            <p className={styles.lead}>
              Завершить болезнь? Замеры и лекарства останутся в журнале, а
              карточка свернётся в итог — вернуть можно в любой момент.
            </p>

            <div className={styles.actions}>
              <Button
                variant="secondary"
                size="lg"
                onClick={() => setConfirming(false)}
              >
                Отменить
              </Button>
              <Button variant="primary" size="lg" onClick={finishSpell}>
                Подтвердить
              </Button>
            </div>
          </Card>
        ) : spell && recoveredAt !== null ? (
          <>
            {startCard(
              `Болезнь закрыта ${formatDayLabel(
                new Date(recoveredAt),
              ).toLowerCase()} в ${formatTime(new Date(recoveredAt))}.`,
            )}
            <Card
              title="Итог болезни"
              collapsible
              action={
                <Button variant="ghost" size="sm" onClick={reopenSpell}>
                  Вернуть болезнь
                </Button>
              }
            >
              <div className={`${styles.big} ${styles.done}`}>
                {formatSpan(recoveredAt - spell.since)}
              </div>
              <p className={styles.sub}>{spellRange}</p>

              <div className={styles.facts}>
                <div className={styles.fact}>
                  <span className={styles.factLabel}>Пик</span>
                  <span className={`${styles.factValue} tnum`}>
                    {formatCelsius(spell.peak.celsius)}
                  </span>
                </div>
                <div className={styles.fact}>
                  <span className={styles.factLabel}>Замеров</span>
                  <span className={`${styles.factValue} tnum`}>
                    {spell.readings.length}
                  </span>
                </div>
                <div className={styles.fact}>
                  <span className={styles.factLabel}>Лекарств</span>
                  <span className={`${styles.factValue} tnum`}>
                    {spellDoses.length}
                  </span>
                </div>
              </div>

              {spellSections(spell, spellDoses)}
            </Card>
          </>
        ) : spell ? (
          <Card
            title="Сейчас"
            action={
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfirming(true)}
              >
                Поправился
              </Button>
            }
          >
            <div className={`${styles.big} tnum ${styles[levelOf(spell.last, ageMonths)]}`}>
              {formatCelsius(spell.last.celsius)}
            </div>
            <p className={styles.sub}>
              {levelWord(levelOf(spell.last, ageMonths))} ·{" "}
              {methodLabel(spell.last.method).toLowerCase()} ·{" "}
              {formatDuration(now - measuredMs(spell.last))} назад
            </p>

            <div className={styles.facts}>
              <div className={styles.fact}>
                <span className={styles.factLabel}>Пик</span>
                <span className={`${styles.factValue} tnum`}>
                  {formatCelsius(spell.peak.celsius)}
                </span>
              </div>
              <div className={styles.fact}>
                <span className={styles.factLabel}>Замеров</span>
                <span className={`${styles.factValue} tnum`}>
                  {spell.readings.length}
                </span>
              </div>
              <div className={styles.fact}>
                <span className={styles.factLabel}>Наблюдаем</span>
                <span className={`${styles.factValue} tnum`}>
                  {formatSpan(now - spell.since)}
                </span>
              </div>
            </div>

            <p className={styles.basis}>
              {methodLabel(spell.last.method)}, {shortAge(ageMonths)}:{" "}
              {highThreshold(spell.last.method, ageMonths) <=
              feverThreshold(spell.last.method)
                ? `красным от ${formatCelsius(feverThreshold(spell.last.method))}`
                : `жёлтым от ${formatCelsius(feverThreshold(spell.last.method))}, красным от ${formatCelsius(highThreshold(spell.last.method, ageMonths))}`}
              . Ориентир, не диагноз.
            </p>

            {addButtons}
          </Card>
        ) : (
          startCard(
            readings.length === 0
              ? "Записей пока нет. Нажмите «Температура», когда будете мерить."
              : "Последний замер был давно — похоже, всё позади.",
          )
        )}

        {recoveredAt !== null ? null : entries.length === 0 ? (
          <EmptyState
            icon="thermometer"
            title="Журнал пуст"
            text="Здесь появятся замеры температуры и выданные лекарства — одной лентой, удобно показать врачу."
          />
        ) : (
          <>
            <Card title="Журнал" flush>
              {renderLog(entries)}
            </Card>
            {readings.length >= 2 && (
              <Card title="Как менялась температура" collapsible>
                <FeverChart
                  readings={spell ? spell.readings : sorted.slice(0, 40)}
                  doses={doses}
                  ageMonths={ageMonths}
                  now={now}
                />
              </Card>
            )}
            <Card title="Выгрузить для врача" collapsible>
              <IllnessReport
                child={child}
                readings={readings}
                doses={doses}
                ageMonths={ageMonths}
                age={formatAge(age)}
                now={now}
              />
            </Card>
          </>
        )}

        {pastSpells.length > 0 && (
          <Card title="История болезней" collapsible>
            {pastSpells.map((sp) => {
              const list = dosesOfSpell(allSpells.indexOf(sp));
              const ended = spellShownEnd(sp);
              const open = openPast === sp.last.id;
              const facts = [
                `пик ${formatCelsius(sp.peak.celsius)}`,
                `${sp.readings.length} ${plural(sp.readings.length, [
                  "замер",
                  "замера",
                  "замеров",
                ])}`,
                list.length > 0
                  ? `${list.length} ${plural(list.length, [
                      "лекарство",
                      "лекарства",
                      "лекарств",
                    ])}`
                  : null,
              ]
                .filter(Boolean)
                .join(" · ");

              return (
                <div key={sp.last.id} className={styles.past}>
                  <button
                    type="button"
                    className={styles.pastHead}
                    aria-expanded={open}
                    onClick={() => setOpenPast(open ? null : sp.last.id)}
                  >
                    <span className={styles.pastText}>
                      <span className={styles.pastWhen}>
                        {rangeOf(sp.since, ended)}
                      </span>
                      <span className={styles.pastFacts}>{facts}</span>
                    </span>
                    {ended - sp.since >= 60_000 && (
                      <span className={`${styles.pastLen} tnum`}>
                        {formatSpan(ended - sp.since)}
                      </span>
                    )}
                    <span
                      className={`${styles.pastChevron} ${
                        open ? styles.pastChevronOpen : ""
                      }`}
                      aria-hidden="true"
                    >
                      <Icon name="chevron-down" size={16} />
                    </span>
                  </button>

                  {open && spellSections(sp, list)}
                </div>
              );
            })}

            <p className={styles.basis}>
              Длительность закрытой болезни считается до отметки «поправился»,
              незакрытой — от первого замера до последнего.
            </p>
          </Card>
        )}
      </div>

      {tempOpen && (
        <TemperatureEditor
          key={picked?.id ?? "new-temp"}
          open={tempOpen}
          onClose={() => setTempOpen(false)}
          childId={child.id}
          reading={picked ?? undefined}
        />
      )}

      {medOpen && (
        <MedicineEditor
          key={pickedDose?.id ?? "new-dose"}
          open={medOpen}
          onClose={() => setMedOpen(false)}
          childId={child.id}
          dose={pickedDose ?? undefined}
        />
      )}
    </>
  );
}
