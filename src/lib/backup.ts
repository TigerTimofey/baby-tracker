/* ---------------------------------------------------------------
   Резервная копия: выгрузка и загрузка всех данных одним файлом.

   Это страховка, не зависящая ни от Supabase, ни от того, что
   браузер однажды почистит своё хранилище. Дневник ребёнка нельзя
   потерять из-за очистки кэша.
   --------------------------------------------------------------- */

import { listAll, save } from "../data/repo";
import { getSettings, updateSettings } from "../data/settings";
import { TABLES, type Settings, type TableName } from "../data/types";

const FORMAT_VERSION = 1;

interface Backup {
  format: number;
  app: "malysh";
  exportedAt: string;
  settings: Settings;
  tables: Record<string, unknown[]>;
}

export async function buildBackup(): Promise<Backup> {
  const tables: Record<string, unknown[]> = {};
  for (const table of TABLES) {
    // Служебный флаг синхронизации в файл не попадает.
    tables[table] = (await listAll(table)).map(({ _dirty, ...rest }) => {
      void _dirty;
      return rest;
    });
  }

  return {
    format: FORMAT_VERSION,
    app: "malysh",
    exportedAt: new Date().toISOString(),
    settings: getSettings(),
    tables,
  };
}

export async function downloadBackup(): Promise<void> {
  const backup = await buildBackup();
  const stamp = backup.exportedAt.slice(0, 10);
  const blob = new Blob([JSON.stringify(backup, null, 2)], {
    type: "application/json",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `malysh-${stamp}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export interface ImportResult {
  imported: number;
  skipped: number;
}

/**
 * Загрузка копии. Записи не затирают более свежие: сравниваем
 * `updated_at`, поэтому файл можно применять поверх текущих данных.
 */
export async function restoreBackup(text: string): Promise<ImportResult> {
  let parsed: Backup;
  try {
    parsed = JSON.parse(text) as Backup;
  } catch {
    throw new Error("Это не файл резервной копии");
  }

  if (parsed.app !== "malysh" || typeof parsed.tables !== "object") {
    throw new Error("Файл не похож на копию «Малыша»");
  }
  if (parsed.format > FORMAT_VERSION) {
    throw new Error("Файл создан более новой версией приложения");
  }

  let imported = 0;
  let skipped = 0;

  for (const table of TABLES) {
    const rows = parsed.tables[table];
    if (!Array.isArray(rows)) continue;

    const existing = new Map(
      (await listAll(table)).map((row) => [row.id, row.updated_at]),
    );

    for (const row of rows as Record<string, unknown>[]) {
      const id = row.id as string | undefined;
      const updatedAt = row.updated_at as string | undefined;
      if (!id || !updatedAt) {
        skipped += 1;
        continue;
      }

      const current = existing.get(id);
      if (current && current >= updatedAt) {
        skipped += 1;
        continue;
      }

      await save(table as TableName, row as never);
      imported += 1;
    }
  }

  if (parsed.settings?.bedtime !== undefined) {
    updateSettings({
      bedtime: parsed.settings.bedtime,
      bedtimeWarnMinutes: parsed.settings.bedtimeWarnMinutes,
    });
  }

  return { imported, skipped };
}
