import { getDbInstance } from "../db/core";

type MigrationResult = {
  candidateRows: number;
  migratedRows: number;
  skippedRows: number;
};

function readSummaryStorageFlag(): boolean {
  const db = getDbInstance();
  const row = db
    .prepare(
      "SELECT value FROM key_value WHERE namespace = 'settings' AND key = 'call_log_summary_storage_enabled'"
    )
    .get() as { value?: string } | undefined;
  const raw = row?.value;
  return raw === "true" || raw === "1";
}

function hasArtifactOnlyMarker(value: unknown): boolean {
  if (typeof value !== "string" || value.length === 0) return false;
  return value.includes('"_artifactOnly":true');
}

export function migrateCallLogsToSummaryStorageMode(options?: {
  dryRun?: boolean;
  limit?: number;
}): MigrationResult {
  const db = getDbInstance();
  const dryRun = options?.dryRun === true;
  const limit = Math.max(1, Math.min(20_000, Number(options?.limit || 5000)));
  const enabled = readSummaryStorageFlag();

  if (!enabled) {
    return { candidateRows: 0, migratedRows: 0, skippedRows: 0 };
  }

  const rows = db
    .prepare(
      `
        SELECT id, request_body, response_body, error
        FROM call_logs
        WHERE artifact_relpath IS NOT NULL
        ORDER BY timestamp ASC, id ASC
        LIMIT ?
      `
    )
    .all(limit) as Array<{
    id: string;
    request_body: string | null;
    response_body: string | null;
    error: string | null;
  }>;

  let candidateRows = 0;
  let migratedRows = 0;
  let skippedRows = 0;

  const toMigrate = rows.filter((row) => {
    const alreadyArtifactOnly =
      hasArtifactOnlyMarker(row.request_body) && hasArtifactOnlyMarker(row.response_body);
    const hasInline =
      (typeof row.request_body === "string" && row.request_body.length > 0) ||
      (typeof row.response_body === "string" && row.response_body.length > 0) ||
      (typeof row.error === "string" && row.error.length > 0);
    if (alreadyArtifactOnly || !hasInline) {
      skippedRows += 1;
      return false;
    }
    candidateRows += 1;
    return true;
  });

  if (!dryRun && toMigrate.length > 0) {
    const update = db.prepare(
      `
        UPDATE call_logs
        SET request_body = ?, response_body = ?, error = NULL
        WHERE id = ?
      `
    );
    const marker = JSON.stringify({ _artifactOnly: true, _schemaVersion: 1 });

    const tx = db.transaction(() => {
      for (const row of toMigrate) {
        const result = update.run(marker, marker, row.id);
        if ((result.changes || 0) > 0) {
          migratedRows += 1;
        }
      }
    });
    tx();
  }

  return {
    candidateRows,
    migratedRows: dryRun ? 0 : migratedRows,
    skippedRows,
  };
}
