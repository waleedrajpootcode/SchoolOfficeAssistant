/**
 * Migration runner for School Office Assistant.
 *
 * How it works:
 *   1. Ensures a `_migrations` tracking table exists.
 *   2. Iterates the registered migration list in order.
 *   3. Skips any migration whose id is already recorded.
 *   4. Runs each pending migration inside a manual transaction (atomic).
 *   5. Records the completed migration id + timestamp.
 *
 * Safe to call on every server startup — idempotent by design.
 *
 * Note: node:sqlite's DatabaseSync does not expose a .transaction() helper;
 * we use raw BEGIN / COMMIT / ROLLBACK instead.
 */

import { getDatabase } from './database.js';
import * as migration001 from './migrations/001_auth_schema.js';
import * as migration002 from './migrations/002_classes_students_attendance.js';
import * as migration003 from './migrations/003_fees.js';

/** All migrations in execution order. Add new entries here as the project grows. */
const MIGRATIONS = [
  migration001,
  migration002,
  migration003,
] as const;

type Migration = {
  id: string;
  up: (db: ReturnType<typeof getDatabase>) => void;
};

/**
 * Run all pending migrations.
 * Called once at server startup before routes are registered.
 */
export function runMigrations(): void {
  const db = getDatabase();

  // Ensure the tracking table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id         TEXT NOT NULL PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  for (const migration of MIGRATIONS as readonly Migration[]) {
    const alreadyApplied = db.prepare(
      'SELECT id FROM _migrations WHERE id = ?'
    ).get(migration.id);

    if (alreadyApplied) {
      continue; // Already done — skip
    }

    // Run atomically with manual transaction
    db.exec('BEGIN');
    try {
      migration.up(db);
      db.prepare('INSERT INTO _migrations (id) VALUES (?)').run(migration.id);
      db.exec('COMMIT');
      console.log(`[migrate] Applied: ${migration.id}`);
    } catch (err) {
      db.exec('ROLLBACK');
      throw new Error(
        `Migration ${migration.id} failed and was rolled back: ${String(err)}`
      );
    }
  }
}
