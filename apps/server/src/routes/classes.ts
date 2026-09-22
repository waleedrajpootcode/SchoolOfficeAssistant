/**
 * Classes routes
 *
 * Admin:
 *   GET    /api/classes          — list all classes
 *   POST   /api/classes          — create a class
 *   PATCH  /api/classes/:id      — update name/section/active
 *   DELETE /api/classes/:id      — soft deactivate
 *
 * Teacher (authenticated, any role):
 *   GET    /api/classes/mine     — list only assigned classes
 */

import type { FastifyInstance } from 'fastify';
import type {
  ApiResponse,
  ClassSummary,
  CreateClassRequest,
  StudentSummary,
  UpdateClassRequest,
} from '@school/shared';
import { getDatabase } from '../db/database.js';
import { authenticate, requireAdmin } from '../hooks/authenticate.js';

interface ClassRow {
  id: number;
  name: string;
  section: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
}

function toClassSummary(row: ClassRow): ClassSummary {
  return {
    id: Number(row.id),
    name: row.name,
    section: row.section ?? null,
    isActive: row.is_active === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

interface RosterRow {
  id: number;
  roll_number: string;
  full_name: string;
  guardian_name: string;
  guardian_phone: string | null;
  class_id: number;
  class_name: string;
  is_active: number;
  created_at: string;
  updated_at: string;
}

function toRosterStudent(row: RosterRow): StudentSummary {
  return {
    id: Number(row.id),
    rollNumber: row.roll_number,
    fullName: row.full_name,
    guardianName: row.guardian_name,
    guardianPhone: row.guardian_phone ?? null,
    classId: Number(row.class_id),
    className: row.class_name,
    isActive: row.is_active === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function classRoutes(fastify: FastifyInstance) {

  // ── GET /api/classes/:id/roster  (authenticated) ─────────────────────────
  // Active students of one class.
  //   - Admin: any active class
  //   - Teacher: only classes they are assigned to
  fastify.get<{ Params: { id: string }; Reply: ApiResponse<StudentSummary[]> }>(
    '/:id/roster',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const classId = Number(request.params.id);
      if (!Number.isInteger(classId) || classId < 1) {
        return reply.code(400).send({ success: false, error: 'Invalid class id' });
      }

      const db = getDatabase();
      const cls = db.prepare(
        'SELECT id FROM classes WHERE id = ? AND is_active = 1'
      ).get(classId);
      if (!cls) {
        return reply.code(400).send({ success: false, error: 'Class not found or inactive' });
      }

      if (request.user!.role === 'teacher') {
        const assigned = db.prepare(
          'SELECT teacher_id FROM teacher_classes WHERE teacher_id = ? AND class_id = ?'
        ).get(request.user!.id, classId);
        if (!assigned) {
          return reply.code(403).send({ success: false, error: 'Not assigned to this class' });
        }
      }

      const rows = db.prepare(
        `SELECT s.id, s.roll_number, s.full_name, s.guardian_name, s.guardian_phone,
                s.class_id, c.name AS class_name, s.is_active, s.created_at, s.updated_at
         FROM students s
         JOIN classes c ON c.id = s.class_id
         WHERE s.class_id = ? AND s.is_active = 1
         ORDER BY s.roll_number`
      ).all(classId) as unknown as RosterRow[];

      return reply.send({ success: true, data: rows.map(toRosterStudent) });
    }
  );

  // ── GET /api/classes/mine  (teacher — own assigned classes) ───────────────
  // Registered BEFORE the /:id route so "mine" isn't treated as an id param
  fastify.get<{ Reply: ApiResponse<ClassSummary[]> }>(
    '/mine',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const db = getDatabase();
      const rows = db.prepare(
        `SELECT c.id, c.name, c.section, c.is_active, c.created_at, c.updated_at
         FROM classes c
         JOIN teacher_classes tc ON tc.class_id = c.id
         WHERE tc.teacher_id = ? AND c.is_active = 1
         ORDER BY c.name`
      ).all(request.user!.id) as unknown as ClassRow[];

      return reply.send({ success: true, data: rows.map(toClassSummary) });
    }
  );

  // ── GET /api/classes  (admin — all classes) ────────────────────────────────
  fastify.get<{ Reply: ApiResponse<ClassSummary[]> }>(
    '/',
    { preHandler: [requireAdmin] },
    async (_request, reply) => {
      const db = getDatabase();
      const rows = db.prepare(
        `SELECT id, name, section, is_active, created_at, updated_at
         FROM classes ORDER BY name`
      ).all() as unknown as ClassRow[];

      return reply.send({ success: true, data: rows.map(toClassSummary) });
    }
  );

  // ── POST /api/classes  (admin) ─────────────────────────────────────────────
  fastify.post<{ Body: CreateClassRequest; Reply: ApiResponse<ClassSummary> }>(
    '/',
    {
      preHandler: [requireAdmin],
      schema: {
        body: {
          type: 'object',
          required: ['name'],
          properties: {
            name:    { type: 'string', minLength: 1, maxLength: 100 },
            section: { type: 'string', maxLength: 50 },
          },
        },
      },
    },
    async (request, reply) => {
      const { name, section } = request.body;
      const db = getDatabase();

      const existing = db.prepare('SELECT id FROM classes WHERE name = ?').get(name);
      if (existing) {
        return reply.code(409).send({ success: false, error: 'Class name already exists' });
      }

      const result = db.prepare(
        `INSERT INTO classes (name, section) VALUES (?, ?)`
      ).run(name, section ?? null);

      const newRow = db.prepare(
        `SELECT id, name, section, is_active, created_at, updated_at FROM classes WHERE id = ?`
      ).get(result.lastInsertRowid as number) as unknown as ClassRow;

      return reply.code(201).send({ success: true, data: toClassSummary(newRow) });
    }
  );

  // ── PATCH /api/classes/:id  (admin) ───────────────────────────────────────
  fastify.patch<{
    Params: { id: string };
    Body: UpdateClassRequest;
    Reply: ApiResponse<ClassSummary>;
  }>(
    '/:id',
    {
      preHandler: [requireAdmin],
      schema: {
        body: {
          type: 'object',
          properties: {
            name:     { type: 'string', minLength: 1, maxLength: 100 },
            section:  { type: 'string', maxLength: 50 },
            isActive: { type: 'boolean' },
          },
        },
      },
    },
    async (request, reply) => {
      const classId = Number(request.params.id);
      if (!Number.isInteger(classId) || classId < 1) {
        return reply.code(400).send({ success: false, error: 'Invalid class id' });
      }

      const db = getDatabase();
      const existing = db.prepare('SELECT id FROM classes WHERE id = ?').get(classId);
      if (!existing) {
        return reply.code(404).send({ success: false, error: 'Class not found' });
      }

      const { name, section, isActive } = request.body;
      const sets: string[] = ["updated_at = datetime('now')"];
      const params: (string | number | null)[] = [];

      if (name !== undefined) {
        const dup = db.prepare('SELECT id FROM classes WHERE name = ? AND id != ?').get(name, classId);
        if (dup) return reply.code(409).send({ success: false, error: 'Class name already exists' });
        sets.push('name = ?'); params.push(name);
      }
      if (section !== undefined) { sets.push('section = ?'); params.push(section); }
      if (isActive !== undefined) { sets.push('is_active = ?'); params.push(isActive ? 1 : 0); }

      if (sets.length === 1) {
        return reply.code(400).send({ success: false, error: 'No fields to update' });
      }

      params.push(classId);
      db.prepare(`UPDATE classes SET ${sets.join(', ')} WHERE id = ?`).run(...params);

      const updated = db.prepare(
        `SELECT id, name, section, is_active, created_at, updated_at FROM classes WHERE id = ?`
      ).get(classId) as unknown as ClassRow;

      return reply.send({ success: true, data: toClassSummary(updated) });
    }
  );

  // ── DELETE /api/classes/:id  (admin — soft deactivate) ────────────────────
  fastify.delete<{ Params: { id: string }; Reply: ApiResponse }>(
    '/:id',
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const classId = Number(request.params.id);
      if (!Number.isInteger(classId) || classId < 1) {
        return reply.code(400).send({ success: false, error: 'Invalid class id' });
      }

      const db = getDatabase();
      const existing = db.prepare('SELECT id FROM classes WHERE id = ?').get(classId);
      if (!existing) {
        return reply.code(404).send({ success: false, error: 'Class not found' });
      }

      db.prepare(`UPDATE classes SET is_active = 0, updated_at = datetime('now') WHERE id = ?`).run(classId);
      return reply.send({ success: true });
    }
  );
}
