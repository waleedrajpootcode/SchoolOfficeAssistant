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
export declare const id = "002_classes_students_attendance";
export declare function up(db: DatabaseSync): void;
//# sourceMappingURL=002_classes_students_attendance.d.ts.map