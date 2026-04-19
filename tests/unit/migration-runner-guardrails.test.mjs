import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";

const { getMigrationRiskFlags, runMigrations } =
  await import("../../src/lib/db/migrationRunner.ts");

function createTempLayout() {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "routiform-migrations-"));
  const migrationsDir = path.join(rootDir, "migrations");
  const backupDir = path.join(rootDir, "backups");
  const dbFile = path.join(rootDir, "storage.sqlite");
  fs.mkdirSync(migrationsDir, { recursive: true });
  fs.mkdirSync(backupDir, { recursive: true });
  return { rootDir, migrationsDir, backupDir, dbFile };
}

function writeMigration(migrationsDir, fileName, sql) {
  fs.writeFileSync(path.join(migrationsDir, fileName), sql, "utf8");
}

function listSqliteBackups(backupDir) {
  return fs.readdirSync(backupDir).filter((name) => name.endsWith(".sqlite"));
}

test("getMigrationRiskFlags ignores risky statements inside triggers/comments", () => {
  const sql = `
    -- DELETE FROM users;
    CREATE TABLE IF NOT EXISTS logs (id INTEGER PRIMARY KEY, value TEXT);
    CREATE TRIGGER IF NOT EXISTS trg_cleanup
    AFTER INSERT ON logs
    BEGIN
      DELETE FROM logs WHERE id < 0;
    END;
  `;

  const risks = getMigrationRiskFlags(sql);
  assert.deepEqual(risks, []);
});

test("getMigrationRiskFlags detects top-level risk even when prior string contains comment tokens", () => {
  const sql = `
    CREATE TABLE IF NOT EXISTS notes (id INTEGER PRIMARY KEY, value TEXT);
    INSERT INTO notes(value) VALUES ('contains -- fake comment and /* block */ text');
    DELETE FROM notes;
  `;

  const risks = getMigrationRiskFlags(sql);
  assert.deepEqual(risks, ["delete_from"]);
});

test("runMigrations allows trigger bodies with BEGIN...END blocks", () => {
  const { rootDir, migrationsDir, backupDir, dbFile } = createTempLayout();
  const db = new Database(dbFile);

  try {
    writeMigration(
      migrationsDir,
      "001_create_logs.sql",
      "CREATE TABLE IF NOT EXISTS logs (id INTEGER PRIMARY KEY, value TEXT);"
    );

    writeMigration(
      migrationsDir,
      "002_trigger_cleanup.sql",
      `
        CREATE TRIGGER IF NOT EXISTS trg_cleanup
        AFTER INSERT ON logs
        BEGIN
          DELETE FROM logs WHERE id < 0;
        END;
      `
    );

    const appliedCount = runMigrations(db, { migrationsDir, backupDir, maxBackupFiles: 3 });
    assert.equal(appliedCount, 2);
    assert.equal(listSqliteBackups(backupDir).length, 0);
  } finally {
    db.close();
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});

test("runMigrations aborts when top-level explicit transaction statements exist", () => {
  const { rootDir, migrationsDir, backupDir, dbFile } = createTempLayout();
  const db = new Database(dbFile);

  try {
    writeMigration(
      migrationsDir,
      "001_bad_explicit_transaction.sql",
      `
        BEGIN TRANSACTION;
        CREATE TABLE IF NOT EXISTS bad_table (id INTEGER PRIMARY KEY);
        COMMIT;
      `
    );

    assert.throws(
      () => runMigrations(db, { migrationsDir, backupDir, maxBackupFiles: 3 }),
      /contains explicit transaction statements/i
    );
  } finally {
    db.close();
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});

test("runMigrations aborts on bare BEGIN statement at top level", () => {
  const { rootDir, migrationsDir, backupDir, dbFile } = createTempLayout();
  const db = new Database(dbFile);

  try {
    writeMigration(
      migrationsDir,
      "001_bad_begin.sql",
      `
        BEGIN;
        CREATE TABLE IF NOT EXISTS bad_begin (id INTEGER PRIMARY KEY);
        COMMIT;
      `
    );

    assert.throws(
      () => runMigrations(db, { migrationsDir, backupDir, maxBackupFiles: 3 }),
      /contains explicit transaction statements/i
    );
  } finally {
    db.close();
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});

test("runMigrations does not treat SQL string literals as transaction statements", () => {
  const { rootDir, migrationsDir, backupDir, dbFile } = createTempLayout();
  const db = new Database(dbFile);

  try {
    writeMigration(
      migrationsDir,
      "001_create_notes.sql",
      "CREATE TABLE IF NOT EXISTS notes (id INTEGER PRIMARY KEY, value TEXT);"
    );
    writeMigration(
      migrationsDir,
      "002_insert_literal.sql",
      "INSERT INTO notes(value) VALUES ('COMMIT and ROLLBACK text');"
    );

    const appliedCount = runMigrations(db, { migrationsDir, backupDir, maxBackupFiles: 3 });
    assert.equal(appliedCount, 2);
  } finally {
    db.close();
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});

test("runMigrations creates pre-migration backup for risky top-level migration", () => {
  const { rootDir, migrationsDir, backupDir, dbFile } = createTempLayout();
  const db = new Database(dbFile);

  try {
    writeMigration(
      migrationsDir,
      "001_create_seed.sql",
      `
        CREATE TABLE IF NOT EXISTS data_store (id INTEGER PRIMARY KEY, value TEXT);
        INSERT INTO data_store (value) VALUES ('seed');
      `
    );

    writeMigration(
      migrationsDir,
      "002_delete_seed.sql",
      "DELETE FROM data_store WHERE value = 'seed';"
    );

    const appliedCount = runMigrations(db, { migrationsDir, backupDir, maxBackupFiles: 3 });
    assert.equal(appliedCount, 2);

    const backups = listSqliteBackups(backupDir);
    assert.ok(backups.some((name) => name.includes("pre-migration")));
  } finally {
    db.close();
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});

test("runMigrations allows risky migrations when backup fails and override is enabled", () => {
  const { rootDir, migrationsDir, backupDir, dbFile } = createTempLayout();
  const db = new Database(dbFile);
  const originalEnv = process.env.ALLOW_UNSAFE_MIGRATION_WITHOUT_BACKUP;

  try {
    process.env.ALLOW_UNSAFE_MIGRATION_WITHOUT_BACKUP = "true";

    writeMigration(
      migrationsDir,
      "001_create_seed.sql",
      `
        CREATE TABLE IF NOT EXISTS data_store (id INTEGER PRIMARY KEY, value TEXT);
        INSERT INTO data_store (value) VALUES ('seed');
      `
    );

    writeMigration(
      migrationsDir,
      "002_delete_seed.sql",
      "DELETE FROM data_store WHERE value = 'seed';"
    );

    fs.rmSync(backupDir, { recursive: true, force: true });
    fs.writeFileSync(backupDir, "not-a-directory");

    const appliedCount = runMigrations(db, { migrationsDir, backupDir, maxBackupFiles: 3 });
    assert.equal(appliedCount, 2);
  } finally {
    if (originalEnv === undefined) {
      delete process.env.ALLOW_UNSAFE_MIGRATION_WITHOUT_BACKUP;
    } else {
      process.env.ALLOW_UNSAFE_MIGRATION_WITHOUT_BACKUP = originalEnv;
    }
    db.close();
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});
