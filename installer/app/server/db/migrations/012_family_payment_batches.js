/**
 * Migration 012 ? Family Payment Batches
 *
 * Groups multiple child fee payments into one family-level payment
 * while preserving each individual fee_payment history.
 */
export const id = '012_family_payment_batches';
export function up(db) {
    db.exec(`
    CREATE TABLE IF NOT EXISTS family_payment_batches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      family_id INTEGER NOT NULL REFERENCES families(id) ON DELETE RESTRICT,
      receipt_number TEXT NOT NULL UNIQUE,
      payment_date TEXT NOT NULL,
      payment_method TEXT NOT NULL DEFAULT 'cash'
        CHECK(payment_method IN ('cash', 'bank', 'online', 'other')),
      total_amount INTEGER NOT NULL CHECK(total_amount > 0),
      received_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_family_payment_batches_family
      ON family_payment_batches(family_id);

    CREATE INDEX IF NOT EXISTS idx_family_payment_batches_date
      ON family_payment_batches(payment_date);
  `);
    const columns = db.prepare(`PRAGMA table_info(fee_payments)`).all();
    if (!columns.some((column) => column.name === 'family_payment_batch_id')) {
        db.exec(`
      ALTER TABLE fee_payments
      ADD COLUMN family_payment_batch_id INTEGER
        REFERENCES family_payment_batches(id) ON DELETE SET NULL
    `);
    }
    db.exec(`
    CREATE INDEX IF NOT EXISTS idx_fee_payments_family_batch
      ON fee_payments(family_payment_batch_id);
  `);
}
//# sourceMappingURL=012_family_payment_batches.js.map