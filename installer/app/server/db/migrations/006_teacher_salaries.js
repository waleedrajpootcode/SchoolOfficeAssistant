export const id = '006_teacher_salaries';
export function up(db) {
    db.exec(`
    CREATE TABLE IF NOT EXISTS teacher_salaries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      teacher_id INTEGER NOT NULL,
      salary_period TEXT NOT NULL,
      salary_due INTEGER NOT NULL CHECK (salary_due >= 0),
      salary_paid INTEGER NOT NULL DEFAULT 0 CHECK (salary_paid >= 0),
      payment_date TEXT,
      payment_method TEXT NOT NULL DEFAULT 'cash'
        CHECK (payment_method IN ('cash', 'bank', 'online', 'other')),
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE (teacher_id, salary_period)
    );

    CREATE INDEX IF NOT EXISTS idx_teacher_salaries_teacher_period
      ON teacher_salaries(teacher_id, salary_period);

    CREATE INDEX IF NOT EXISTS idx_teacher_salaries_period
      ON teacher_salaries(salary_period);
  `);
}
//# sourceMappingURL=006_teacher_salaries.js.map