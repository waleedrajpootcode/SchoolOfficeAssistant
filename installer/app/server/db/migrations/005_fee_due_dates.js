export const id = '005_fee_due_dates';
export function up(db) {
    db.exec(`
    ALTER TABLE student_fees
    ADD COLUMN due_date TEXT
  `);
    db.exec(`
    CREATE INDEX IF NOT EXISTS idx_student_fees_due_date
    ON student_fees(due_date)
  `);
}
//# sourceMappingURL=005_fee_due_dates.js.map