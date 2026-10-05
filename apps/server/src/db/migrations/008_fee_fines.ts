import type { DatabaseSync } from 'node:sqlite';

export const id = '008_fee_fines';

export function up(db: DatabaseSync): void {
  db.exec(`
    ALTER TABLE student_fees
    ADD COLUMN fine_start_date TEXT;
  `);

  db.exec(`
    ALTER TABLE student_fees
    ADD COLUMN fine_amount INTEGER NOT NULL DEFAULT 0;
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_student_fees_fine_start_date
      ON student_fees(fine_start_date);
  `);
}
