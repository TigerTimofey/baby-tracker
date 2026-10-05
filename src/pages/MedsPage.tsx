import { t } from "../lib/i18n";
import { useActiveChild, useLive, useNow } from "../data/hooks";
import { listByChild } from "../data/repo";
import type { Medicine, MedicineCourse } from "../data/types";
import { MedicineCourses } from "../features/illness/MedicineCourses";

const NO_DOSES: Medicine[] = [];
const NO_COURSES: MedicineCourse[] = [];

/**
 * «Аптечка» — курсы лекарств и добавок своей вкладкой. Витамин D каждое
 * утро — не болезнь, и держать его на вкладке «Болезнь» было неловко; а во
 * время болезни курс антибиотика здесь же, в одном нажатии от журнала.
 * Выдачи при этом общие: записанное тут видно в журнале болезни и в выгрузке
 * для врача.
 */
export function MedsPage() {
  const { child } = useActiveChild();
  const childId = child?.id;
  const now = useNow(60_000);

  const { data: doseData } = useLive(
    async () => (childId ? await listByChild("medicines", childId) : NO_DOSES),
    [childId],
  );
  const { data: courseData } = useLive(
    async () =>
      childId ? await listByChild("medicine_courses", childId) : NO_COURSES,
    [childId],
  );

  if (!child) return null;

  return (
    <>
      <h1 className="sr-only">{t("Аптечка")}</h1>
      <MedicineCourses
        childId={child.id}
        courses={courseData ?? NO_COURSES}
        doses={doseData ?? NO_DOSES}
        now={now}
      />
    </>
  );
}
