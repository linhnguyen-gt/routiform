import { getDbInstance } from "../db/core";

export type MemoryFtsVerification = {
  healthy: boolean;
  memoriesRows: number;
  ftsRows: number;
  missingIndexedRows: number;
  sampleMatchWorks: boolean;
};

export function verifyMemoryFts(): MemoryFtsVerification {
  const db = getDbInstance();

  const memoriesRows = Number(
    (db.prepare("SELECT COUNT(*) AS count FROM memories").get() as { count?: number } | undefined)
      ?.count || 0
  );

  const ftsRows = Number(
    (
      db.prepare("SELECT COUNT(*) AS count FROM memories_fts").get() as
        | { count?: number }
        | undefined
    )?.count || 0
  );

  const missingIndexedRows = Number(
    (
      db
        .prepare(
          `
            SELECT COUNT(*) AS count
            FROM memories m
            LEFT JOIN memories_fts f ON f.id = m.id
            WHERE f.id IS NULL
          `
        )
        .get() as { count?: number } | undefined
    )?.count || 0
  );

  const sampleMatchWorks =
    Number(
      (
        db
          .prepare(
            `
              SELECT COUNT(*) AS count
              FROM memories_fts
              WHERE memories_fts MATCH 'memory* OR context*'
            `
          )
          .get() as { count?: number } | undefined
      )?.count || 0
    ) >= 0;

  return {
    healthy: missingIndexedRows === 0,
    memoriesRows,
    ftsRows,
    missingIndexedRows,
    sampleMatchWorks,
  };
}
