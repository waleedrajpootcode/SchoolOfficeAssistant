/**
 * Migration 011 ? Fee Fine Waivers
 *
 * Adds audit-safe fine waiver information to student fee records.
 * The original fine_amount is preserved; waiver data is stored separately.
 */

import type { DatabaseSync } from 'node:sqlite';

export const id = '011_fee_fine_waivers';

export function up(db: DatabaseSync): void {
  const columns = db.prepare(`PRAGMA table_info(student_fees)`).all() as Array<{
    name: string;
  }>;

  const hasColumn = (name: string) =>
    columns.some((column) => column.name === name);

  if (!hasColumn('fine_waived')) {
    db.exec(`
      ALTER TABLE student_fees
      ADD COLUMN fine_waived INTEGER NOT NULL DEFAULT 0
      CHECK(fine_waived IN (0, 1))
    `);
  }

  if (!hasColumn('fine_waived_amount')) {
    db.exec(`
      ALTER TABLE student_fees
      ADD COLUMN fine_waived_amount INTEGER NOT NULL DEFAULT 0
      CHECK(fine_waived_amount >= 0)
    `);
  }

  if (!hasColumn('fine_waived_at')) {
    db.exec(`
      ALTER TABLE student_fees
      ADD COLUMN fine_waived_at TEXT
    `);
  }

  if (!hasColumn('fine_waived_by')) {
    db.exec(`
      ALTER TABLE student_fees
      ADD COLUMN fine_waived_by INTEGER REFERENCES users(id) ON DELETE SET NULL
    `);
  }

  if (!hasColumn('fine_waived_reason')) {
    db.exec(`
      ALTER TABLE student_fees
      ADD COLUMN fine_waived_reason TEXT
    `);
  }

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_student_fees_fine_waived
      ON student_fees(fine_waived);
  `);
}
