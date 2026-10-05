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
 * Safe to call on every server startup â€” idempotent by design.
 *
 * Note: node:sqlite's DatabaseSync does not expose a .transaction() helper;
 * we use raw BEGIN / COMMIT / ROLLBACK instead.
 */
import { getDatabase } from './database.js';
import * as migration001 from './migrations/001_auth_schema.js';
import * as migration002 from './migrations/002_classes_students_attendance.js';
import * as migration003 from './migrations/003_fees.js';
import * as migration004 from './migrations/004_school_settings.js';
import * as migration005 from './migrations/005_fee_due_dates.js';
import * as migration006 from './migrations/006_teacher_salaries.js';
import * as migration007 from './migrations/007_teacher_profiles.js';
import * as migration008 from './migrations/008_fee_fines.js';
import * as migration009 from './migrations/009_fee_rules.js';
import * as migration010 from './migrations/010_student_fee_assignments.js';
import * as migration011 from './migrations/011_fee_fine_waivers.js';
import * as migration012 from './migrations/012_family_payment_batches.js';
import * as migration013 from './migrations/013_family_structure.js';
/** All migrations in execution order. Add new entries here as the project grows. */
const MIGRATIONS = [
    migration001,
    migration002,
    migration003,
    migration004,
    migration005,
    migration006,
    migration007,
    migration008,
    migration009,
    migration010,
    migration011,
    migration012,
    migration013
];
/**
 * Run all pending migrations.
 * Called once at server startup before routes are registered.
 */
export function runMigrations() {
    const db = getDatabase();
    // Ensure the tracking table exists
    db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id         TEXT NOT NULL PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
    for (const migration of MIGRATIONS) {
        const alreadyApplied = db.prepare('SELECT id FROM _migrations WHERE id = ?').get(migration.id);
        if (alreadyApplied) {
            continue; // Already done â€” skip
        }
        // Run atomically with manual transaction
        db.exec('BEGIN');
        try {
            migration.up(db);
            db.prepare('INSERT INTO _migrations (id) VALUES (?)').run(migration.id);
            db.exec('COMMIT');
            console.log(`[migrate] Applied: ${migration.id}`);
        }
        catch (err) {
            db.exec('ROLLBACK');
            throw new Error(`Migration ${migration.id} failed and was rolled back: ${String(err)}`);
        }
    }
}
//# sourceMappingURL=migrate.js.map