export const id = '010_student_fee_assignments';
export function up(db) {
    db.exec(`
    CREATE TABLE IF NOT EXISTS student_fee_assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      fee_structure_id INTEGER NOT NULL REFERENCES fee_structures(id) ON DELETE RESTRICT,
      amount INTEGER NOT NULL CHECK(amount >= 0),
      effective_from TEXT NOT NULL,
      effective_to TEXT,
      is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      CHECK(effective_to IS NULL OR effective_to >= effective_from)
    );

    CREATE INDEX IF NOT EXISTS idx_student_fee_assignments_student
      ON student_fee_assignments(student_id);

    CREATE INDEX IF NOT EXISTS idx_student_fee_assignments_active_period
      ON student_fee_assignments(student_id, is_active, effective_from);

    CREATE UNIQUE INDEX IF NOT EXISTS uq_student_fee_assignment_active
      ON student_fee_assignments(student_id)
      WHERE is_active = 1 AND effective_to IS NULL;
  `);
}
//# sourceMappingURL=010_student_fee_assignments.js.map