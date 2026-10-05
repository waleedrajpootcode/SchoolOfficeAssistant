export const id = '009_fee_rules';
export function up(db) {
    db.exec(`
    CREATE TABLE IF NOT EXISTS fee_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fee_structure_id INTEGER NOT NULL UNIQUE
        REFERENCES fee_structures(id) ON DELETE CASCADE,
      last_date_day INTEGER,
      fine_start_day INTEGER,
      fine_amount INTEGER NOT NULL DEFAULT 0 CHECK (fine_amount >= 0),
      is_active INTEGER NOT NULL DEFAULT 1
        CHECK (is_active IN (0, 1)),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      CHECK (
        last_date_day IS NULL
        OR (last_date_day >= 1 AND last_date_day <= 31)
      ),
      CHECK (
        fine_start_day IS NULL
        OR (fine_start_day >= 1 AND fine_start_day <= 31)
      ),
      CHECK (
        fine_amount = 0
        OR fine_start_day IS NOT NULL
      )
    )
  `);
    db.exec(`
    CREATE INDEX IF NOT EXISTS idx_fee_rules_structure
      ON fee_rules(fee_structure_id)
  `);
    db.exec(`
    CREATE INDEX IF NOT EXISTS idx_fee_rules_active
      ON fee_rules(is_active)
  `);
}
//# sourceMappingURL=009_fee_rules.js.map