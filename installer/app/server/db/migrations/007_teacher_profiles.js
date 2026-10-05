export const id = '007_teacher_profiles';
export function up(db) {
    db.exec(`
    CREATE TABLE IF NOT EXISTS teacher_profiles (
      teacher_id INTEGER PRIMARY KEY,
      phone TEXT,
      email TEXT,
      subject TEXT,
      joining_date TEXT,
      monthly_salary INTEGER NOT NULL DEFAULT 0 CHECK (monthly_salary >= 0),
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_teacher_profiles_subject
      ON teacher_profiles(subject);

    CREATE INDEX IF NOT EXISTS idx_teacher_profiles_joining_date
      ON teacher_profiles(joining_date);
  `);
}
//# sourceMappingURL=007_teacher_profiles.js.map