/**
 * Migration 002 — Classes (extend), Students, Attendance
 *
 * Extends the existing `classes` table with section, is_active, updated_at.
 * Extends the existing `teacher_classes` table with created_at.
 * Adds new tables: students, attendance.
 *
 * SQLite only supports ADD COLUMN — we cannot drop/rename existing columns.
 * All new columns use defaults so existing rows remain valid.
 */

import type { DatabaseSync } from 'node:sqlite';

export const id = '002_classes_students_attendance';

/**
 * SQLite has no "ADD COLUMN IF NOT EXISTS". Instead of silently swallowing every
 * ALTER error (which would also hide real failures), check the column list
 * first and only run the ALTER when the column is genuinely missing.
 */
function hasColumn(db: DatabaseSync, table: string, column: string): boolean {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as unknown as Array<{ name: string }>;
  return cols.some((c) => c.name === column);
}

function addColumnIfMissing(db: DatabaseSync, table: string, column: string, definition: string): void {
  if (hasColumn(db, table, column)) return;
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

export function up(db: DatabaseSync): void {

  // ── Extend classes ─────────────────────────────────────────────────────────
  addColumnIfMissing(db, 'classes', 'section',    'TEXT');
  addColumnIfMissing(db, 'classes', 'is_active',  'INTEGER NOT NULL DEFAULT 1');
  addColumnIfMissing(db, 'classes', 'updated_at', `TEXT NOT NULL DEFAULT (datetime('now'))`);

  // ── Extend teacher_classes ────────────────────────────────────────────────
  addColumnIfMissing(db, 'teacher_classes', 'created_at', `TEXT NOT NULL DEFAULT (datetime('now'))`);

  // ── students ───────────────────────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS students (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      roll_number    TEXT    NOT NULL UNIQUE,
      full_name      TEXT    NOT NULL,
      guardian_name  TEXT    NOT NULL,
      guardian_phone TEXT,
      class_id       INTEGER NOT NULL REFERENCES classes(id),
      is_active      INTEGER NOT NULL DEFAULT 1,
      created_at     TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at     TEXT    NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // ── attendance ─────────────────────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS attendance (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id      INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      attendance_date TEXT    NOT NULL,
      status          TEXT    NOT NULL CHECK(status IN ('present','absent','leave')),
      marked_by       INTEGER NOT NULL REFERENCES users(id),
      created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at      TEXT    NOT NULL DEFAULT (datetime('now')),
      UNIQUE(student_id, attendance_date)
    )
  `);

  // ── indexes ────────────────────────────────────────────────────────────────
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_students_class_id         ON students(class_id);
    CREATE INDEX IF NOT EXISTS idx_students_roll_number      ON students(roll_number);
    CREATE INDEX IF NOT EXISTS idx_attendance_student_date   ON attendance(student_id, attendance_date);
    CREATE INDEX IF NOT EXISTS idx_attendance_date_class     ON attendance(attendance_date);
  `);
}
