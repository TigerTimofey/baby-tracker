import { useState } from "react";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { Icon } from "../components/ui/Icon";
import { useActiveChild, useAuthorLabel, useLive, useNow } from "../data/hooks";
import { listByChild } from "../data/repo";
import type { Medicine, Temperature } from "../data/types";
import { FeverChart } from "../features/illness/FeverChart";
import { IllnessReport } from "../features/illness/IllnessReport";
import { MedicineEditor } from "../features/illness/MedicineEditor";
import { TemperatureEditor } from "../features/illness/TemperatureEditor";
import { doseLine, givenMs, nextDoses } from "../features/illness/medUtils";
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

  const waiting = nextDoses(doses, now);

  const entries: Entry[] = [
    ...sorted.map(
      (reading): Entry => ({ kind: "temp", at: measuredMs(reading), reading }),
    ),
    ...doses.map((dose): Entry => ({ kind: "dose", at: givenMs(dose), dose })),
  ].sort((a, b) => b.at - a.at);

  const days = new Map<string, Entry[]>();
  for (const entry of entries) {
    const key = new Date(entry.at).toDateString();
    const bucket = days.get(key);
    if (bucket) bucket.push(entry);
    else days.set(key, [entry]);
  }


  return (
    <>
      <h1 className="sr-only">Контроль болезни</h1>

      <div className={styles.stack}>
        {spell ? (
          <Card title="Сейчас">
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
                  {formatDuration(now - spell.since)}
                </span>
              </div>
            </div>

            <p className={styles.basis}>
              Способ «{methodLabel(spell.last.method).toLowerCase()}», возраст{" "}
              {shortAge(ageMonths)}:{" "}
              {highThreshold(spell.last.method, ageMonths) <=
              feverThreshold(spell.last.method) ? (
                <>
                  красным от {formatCelsius(feverThreshold(spell.last.method))}{" "}
                  — до трёх месяцев любой жар считается тревожным, поэтому
                  отдельной жёлтой полосы здесь нет.
                </>
              ) : (
                <>
                  жёлтым от{" "}
                  {formatCelsius(feverThreshold(spell.last.method))}, красным от{" "}
                  {formatCelsius(highThreshold(spell.last.method, ageMonths))}.
                  Чем младше ребёнок, тем ниже вторая граница.
                </>
              )}{" "}
              Это ориентиры, а не диагноз — решает педиатр.
            </p>

              {waiting.length > 0 && (
                <ul className={styles.doses}>
                  {waiting.map((item) => (
                    <li key={item.name} className={styles.dose}>
                      <span className={styles.doseName}>{item.name}</span>
                      <span
                        className={`${styles.doseWhen} ${item.ready ? styles.doseReady : ""}`}
                      >
                        {item.ready
                          ? "можно давать"
                          : `не раньше ${formatTime(new Date(item.readyAt))} · через ${formatDuration(item.readyAt - now)}`}
                      </span>
                    </li>
                  ))}
                  <li className={styles.doseNote}>
                    Одно и то же лекарство — не чаще чем раз в{" "}
                    {waiting[0].gapHours} часов. Это общий ориентир: точный
                    интервал в инструкции и у педиатра.
                  </li>
                </ul>
              )}

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
          </Card>
        ) : (
          <Card title="Сейчас">
            <p className={styles.lead}>
              {readings.length === 0
                ? "Записей пока нет. Нажмите «Температура», когда будете мерить."
                : "Последний замер был давно — похоже, всё позади."}
            </p>

              {waiting.length > 0 && (
                <ul className={styles.doses}>
                  {waiting.map((item) => (
                    <li key={item.name} className={styles.dose}>
                      <span className={styles.doseName}>{item.name}</span>
                      <span
                        className={`${styles.doseWhen} ${item.ready ? styles.doseReady : ""}`}
                      >
                        {item.ready
                          ? "можно давать"
                          : `не раньше ${formatTime(new Date(item.readyAt))} · через ${formatDuration(item.readyAt - now)}`}
                      </span>
                    </li>
                  ))}
                  <li className={styles.doseNote}>
                    Одно и то же лекарство — не чаще чем раз в{" "}
                    {waiting[0].gapHours} часов. Это общий ориентир: точный
                    интервал в инструкции и у педиатра.
                  </li>
                </ul>
              )}

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
          </Card>
        )}

        {entries.length === 0 ? (
          <EmptyState
            icon="thermometer"
            title="Журнал пуст"
            text="Здесь появятся замеры температуры и выданные лекарства — одной лентой, удобно показать врачу."
          />
        ) : (
          <Card title="Журнал" flush>
            {[...days.entries()].map(([key, list]) => (
              <div key={key} className={styles.day}>
                <div className={styles.dayHead}>
                  <span className={styles.dayName}>
                    {formatDayLabel(new Date(key))}
                    {formatDayLabel(new Date(key)) !==
                      formatDayDate(new Date(key)) && (
                      <span className={styles.dayDate}>
                        {formatDayDate(new Date(key))}
                      </span>
                    )}
                  </span>
                  <span className={styles.dayCount}>
                    {list.length}{" "}
                    {plural(list.length, ["запись", "записи", "записей"])}
                  </span>
                </div>

                {list.map((entry) => {
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
                            {doseLine(entry.dose)}
                            {who ? ` · ${who}` : ""}
                          </span>
                          {entry.dose.note && (
                            <span className={styles.rowNote}>
                              {entry.dose.note}
                            </span>
                          )}
                        </span>
                        <span className={styles.pill}>лекарство</span>
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
            ))}
          </Card>
        )}
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
        {entries.length > 0 && (
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
