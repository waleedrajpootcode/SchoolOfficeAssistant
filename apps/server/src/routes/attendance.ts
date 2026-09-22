/**
 * Attendance routes
 *
 * GET  /api/attendance?classId=&attendanceDate=
 *       — Admin: any class
 *       — Teacher: only assigned classes
 *
 * POST /api/attendance
 *       — Bulk upsert attendance for one class on one date
 *       — Teacher: only for assigned classes; students must belong to that class
 *       — Admin: any class
 *       — Transactional (BEGIN / COMMIT / ROLLBACK)
 */

import type { FastifyInstance } from 'fastify';
import type {
  ApiResponse,
  AttendanceRecord,
  StudentSummary,
  SubmitAttendanceRequest,
} from '@school/shared';
import { isValidYYYYMMDD } from '@school/shared';
import { getDatabase } from '../db/database.js';
import { authenticate } from '../hooks/authenticate.js';

interface AttendanceRow {
  id: number;
  student_id: number;
  student_name: string;
  roll_number: string;
  attendance_date: string;
  status: string;
  marked_by: number;
  marker_name: string;
  created_at: string;
  updated_at: string;
}

function toRecord(row: AttendanceRow): AttendanceRecord {
  return {
    id: Number(row.id),
    studentId: Number(row.student_id),
    studentName: row.student_name,
    rollNumber: row.roll_number,
    attendanceDate: row.attendance_date,
    status: row.status as AttendanceRecord['status'],
    markedById: Number(row.marked_by),
    markedByName: row.marker_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function attendanceRoutes(fastify: FastifyInstance) {

  // ── GET /api/attendance ────────────────────────────────────────────────────
  fastify.get<{
    Querystring: { classId?: string; attendanceDate?: string };
    Reply: ApiResponse<AttendanceRecord[]>;
  }>(
    '/',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { classId: rawClassId, attendanceDate } = request.query;
      const classId = rawClassId ? Number(rawClassId) : NaN;

      if (!Number.isInteger(classId) || classId < 1) {
        return reply.code(400).send({ success: false, error: 'classId must be a positive integer' });
      }
      if (!attendanceDate || !isValidYYYYMMDD(attendanceDate)) {
        return reply.code(400).send({ success: false, error: 'attendanceDate must be a real date in YYYY-MM-DD format' });
      }

      const user = request.user!;
      const db = getDatabase();

      // Validate the class exists and is active (applies to admin and teacher)
      const cls = db.prepare(
        'SELECT id FROM classes WHERE id = ? AND is_active = 1'
      ).get(classId);
      if (!cls) {
        return reply.code(400).send({ success: false, error: 'Class not found or inactive' });
      }

      // Teacher: verify assigned to this active class
      if (user.role === 'teacher') {
        const assigned = db.prepare(
          'SELECT teacher_id FROM teacher_classes WHERE teacher_id = ? AND class_id = ?'
        ).get(user.id, classId);
        if (!assigned) {
          return reply.code(403).send({ success: false, error: 'Not assigned to this class' });
        }
      }

      const rows = db.prepare(
        `SELECT a.id, a.student_id, s.full_name AS student_name, s.roll_number,
                a.attendance_date, a.status, a.marked_by,
                u.display_name AS marker_name,
                a.created_at, a.updated_at
         FROM attendance a
         JOIN students s ON s.id = a.student_id
         JOIN users    u ON u.id = a.marked_by
         WHERE s.class_id = ? AND a.attendance_date = ?
         ORDER BY s.roll_number`
      ).all(classId, attendanceDate) as unknown as AttendanceRow[];

      return reply.send({ success: true, data: rows.map(toRecord) });
    }
  );

  // ── POST /api/attendance ───────────────────────────────────────────────────
  fastify.post<{ Body: SubmitAttendanceRequest; Reply: ApiResponse<AttendanceRecord[]> }>(
    '/',
    {
      preHandler: [authenticate],
      schema: {
        body: {
          type: 'object',
          required: ['classId', 'attendanceDate', 'records'],
          properties: {
            classId:        { type: 'integer', minimum: 1 },
            attendanceDate: { type: 'string' },
            records: {
              type: 'array',
              minItems: 1,
              items: {
                type: 'object',
                required: ['studentId', 'status'],
                properties: {
                  studentId: { type: 'integer', minimum: 1 },
                  status:    { type: 'string', enum: ['present', 'absent', 'leave'] },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { classId, attendanceDate, records } = request.body;
      const user = request.user!;

      if (!isValidYYYYMMDD(attendanceDate)) {
        return reply.code(400).send({ success: false, error: 'attendanceDate must be a real date in YYYY-MM-DD format' });
      }

      const db = getDatabase();

      // Teacher: must be assigned to this class
      if (user.role === 'teacher') {
        const assigned = db.prepare(
          'SELECT teacher_id FROM teacher_classes WHERE teacher_id = ? AND class_id = ?'
        ).get(user.id, classId);
        if (!assigned) {
          return reply.code(403).send({ success: false, error: 'Not assigned to this class' });
        }
      }

      // Validate class exists AND is active — inactive classes cannot accept new attendance
      const cls = db.prepare(
        'SELECT id FROM classes WHERE id = ? AND is_active = 1'
      ).get(classId);
      if (!cls) {
        return reply.code(400).send({ success: false, error: 'Class not found or inactive' });
      }

      // Validate every submitted student belongs to this class AND is active —
      // inactive students cannot receive new attendance
      const studentIds = records.map(r => r.studentId);
      // Check duplicates in submission
      const uniqueIds = new Set(studentIds);
      if (uniqueIds.size !== studentIds.length) {
        return reply.code(400).send({ success: false, error: 'Duplicate student in submission' });
      }

      for (const sid of studentIds) {
        const st = db.prepare(
          'SELECT id FROM students WHERE id = ? AND class_id = ? AND is_active = 1'
        ).get(sid, classId);
        if (!st) {
          return reply.code(400).send({
            success: false,
            error: `Student ${sid} is not an active member of class ${classId}`,
          });
        }
      }

      // Upsert each record — manual transaction (node:sqlite has no .transaction())
      db.exec('BEGIN');
      try {
        const upsert = db.prepare(
          `INSERT INTO attendance (student_id, attendance_date, status, marked_by, updated_at)
           VALUES (?, ?, ?, ?, datetime('now'))
           ON CONFLICT(student_id, attendance_date)
           DO UPDATE SET status = excluded.status,
                         marked_by = excluded.marked_by,
                         updated_at = datetime('now')`
        );
        for (const rec of records) {
          upsert.run(rec.studentId, attendanceDate, rec.status, user.id);
        }
        db.exec('COMMIT');
      } catch (err) {
        db.exec('ROLLBACK');
        throw err;
      }

      // Return the saved records
      const saved = db.prepare(
        `SELECT a.id, a.student_id, s.full_name AS student_name, s.roll_number,
                a.attendance_date, a.status, a.marked_by,
                u.display_name AS marker_name,
                a.created_at, a.updated_at
         FROM attendance a
         JOIN students s ON s.id = a.student_id
         JOIN users    u ON u.id = a.marked_by
         WHERE s.class_id = ? AND a.attendance_date = ?
           AND a.student_id IN (${studentIds.map(() => '?').join(',')})
         ORDER BY s.roll_number`
      ).all(classId, attendanceDate, ...studentIds) as unknown as AttendanceRow[];

      return reply.send({ success: true, data: saved.map(toRecord) });
    }
  );
}
