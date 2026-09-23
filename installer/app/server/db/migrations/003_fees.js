/**
 * Migration 003 — Fees
 *
 * Adds:
 * - fee_structures
 * - student_fees
 * - fee_payments
 *
 * Monthly fee tracking with payment history and receipt/reference numbers.
 */
export const id = '003_fees';
export function up(db) {
    // ── fee structures ────────────────────────────────────────────────────────
    // Defines the default fee amount for a class.
    db.exec(`
    CREATE TABLE IF NOT EXISTS fee_structures (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      class_id    INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
      fee_name    TEXT    NOT NULL,
      amount      INTEGER NOT NULL CHECK(amount >= 0),
      is_active   INTEGER NOT NULL DEFAULT 1,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT    NOT NULL DEFAULT (datetime('now')),
      UNIQUE(class_id, fee_name)
    )
  `);
    // ── student fees ──────────────────────────────────────────────────────────
    // One monthly/period fee record for a specific student.
    db.exec(`
    CREATE TABLE IF NOT EXISTS student_fees (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id     INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      fee_structure_id INTEGER REFERENCES fee_structures(id) ON DELETE SET NULL,
      fee_period     TEXT    NOT NULL,
      amount_due     INTEGER NOT NULL CHECK(amount_due >= 0),
      status         TEXT    NOT NULL DEFAULT 'unpaid'
                     CHECK(status IN ('unpaid', 'partial', 'paid')),
      notes          TEXT,
      created_at     TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at     TEXT    NOT NULL DEFAULT (datetime('now')),
      UNIQUE(student_id, fee_period)
    )
  `);
    // ── fee payments ──────────────────────────────────────────────────────────
    // Every payment is kept as a separate history record.
    db.exec(`
    CREATE TABLE IF NOT EXISTS fee_payments (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      student_fee_id  INTEGER NOT NULL REFERENCES student_fees(id) ON DELETE CASCADE,
      amount          INTEGER NOT NULL CHECK(amount > 0),
      payment_date    TEXT    NOT NULL,
      payment_method  TEXT    NOT NULL DEFAULT 'cash'
                      CHECK(payment_method IN ('cash', 'bank', 'online', 'other')),
      receipt_number  TEXT    NOT NULL UNIQUE,
      received_by     INTEGER NOT NULL REFERENCES users(id),
      notes           TEXT,
      created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
    )
  `);
    // ── indexes ────────────────────────────────────────────────────────────────
    db.exec(`
    CREATE INDEX IF NOT EXISTS idx_fee_structures_class
      ON fee_structures(class_id);

    CREATE INDEX IF NOT EXISTS idx_student_fees_student_period
      ON student_fees(student_id, fee_period);

    CREATE INDEX IF NOT EXISTS idx_student_fees_period
      ON student_fees(fee_period);

    CREATE INDEX IF NOT EXISTS idx_student_fees_status
      ON student_fees(status);

    CREATE INDEX IF NOT EXISTS idx_fee_payments_student_fee
      ON fee_payments(student_fee_id);

    CREATE INDEX IF NOT EXISTS idx_fee_payments_date
      ON fee_payments(payment_date);
  `);
}
//# sourceMappingURL=003_fees.js.map