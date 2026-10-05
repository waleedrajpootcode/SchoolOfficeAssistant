import type { FastifyInstance } from 'fastify';
import type { ApiResponse } from '@school/shared';
import { getDatabase } from '../db/database.js';
import { requireAdmin } from '../hooks/authenticate.js';

interface FamilyChild {
  id: number;
  rollNumber: string;
  fullName: string;
  guardianName: string;
  guardianPhone: string | null;
  classId: number;
  className: string;
  isActive: boolean;
}

interface FamilySummary {
  id: number;
  guardianName: string;
  guardianPhone: string | null;
  address: string | null;
  notes: string | null;
  isActive: boolean;
  childrenCount: number;
  children: FamilyChild[];
  createdAt: string;
  updatedAt: string;
}

function getFamily(db: ReturnType<typeof getDatabase>, familyId: number): FamilySummary | null {
  const family = db.prepare(`
    SELECT id, guardian_name, guardian_phone, address, notes,
           is_active, created_at, updated_at
    FROM families
    WHERE id = ?
  `).get(familyId) as any;

  if (!family) return null;

  const children = db.prepare(`
    SELECT s.id, s.roll_number, s.full_name, s.guardian_name,
           s.guardian_phone, s.class_id, c.name AS class_name,
           s.is_active
    FROM students s
    JOIN classes c ON c.id = s.class_id
    WHERE s.family_id = ?
    ORDER BY s.roll_number, s.full_name
  `).all(familyId) as any[];

  return {
    id: Number(family.id),
    guardianName: family.guardian_name,
    guardianPhone: family.guardian_phone,
    address: family.address,
    notes: family.notes,
    isActive: family.is_active === 1,
    childrenCount: children.length,
    children: children.map((c) => ({
      id: Number(c.id),
      rollNumber: c.roll_number,
      fullName: c.full_name,
      guardianName: c.guardian_name,
      guardianPhone: c.guardian_phone,
      classId: Number(c.class_id),
      className: c.class_name,
      isActive: c.is_active === 1,
    })),
    createdAt: family.created_at,
    updatedAt: family.updated_at,
  };
}

export async function familyRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', requireAdmin);

  // GET /api/families?q=...
  fastify.get<{
    Querystring: { q?: string; activeOnly?: string };
    Reply: ApiResponse<FamilySummary[]>;
  }>('/', async (request, reply) => {
    const db = getDatabase();
    const q = request.query.q?.trim() ?? '';
    const activeOnly = request.query.activeOnly !== 'false';

    let sql = `
      SELECT DISTINCT f.id
      FROM families f
      LEFT JOIN students s ON s.family_id = f.id
      WHERE 1 = 1
    `;

    const params: (string | number)[] = [];

    if (activeOnly) {
      sql += ' AND f.is_active = 1';
    }

    if (q) {
      sql += `
        AND (
          lower(f.guardian_name) LIKE lower(?)
          OR COALESCE(f.guardian_phone, '') LIKE ?
          OR lower(COALESCE(s.full_name, '')) LIKE lower(?)
          OR lower(COALESCE(s.roll_number, '')) LIKE lower(?)
          OR lower(COALESCE(s.guardian_name, '')) LIKE lower(?)
        )
      `;

      const term = `%${q}%`;
      params.push(term, term, term, term, term);
    }

    sql += ' ORDER BY f.guardian_name, f.id';

    const ids = db.prepare(sql).all(...params) as any[];

    const data = ids
      .map((row) => getFamily(db, Number(row.id)))
      .filter(Boolean) as FamilySummary[];

    return reply.send({ success: true, data });
  });

  // GET /api/families/:id
  fastify.get<{
    Params: { id: string };
    Reply: ApiResponse<FamilySummary>;
  }>('/:id', async (request, reply) => {
    const familyId = Number(request.params.id);

    if (!Number.isInteger(familyId) || familyId < 1) {
      return reply.code(400).send({
        success: false,
        error: 'Invalid family id',
      });
    }

    const family = getFamily(getDatabase(), familyId);

    if (!family) {
      return reply.code(404).send({
        success: false,
        error: 'Family not found',
      });
    }

    return reply.send({ success: true, data: family });
  });

  // POST /api/families
  fastify.post<{
    Body: {
      guardianName: string;
      guardianPhone?: string | null;
      address?: string | null;
      notes?: string | null;
      studentIds?: number[];
    };
    Reply: ApiResponse<FamilySummary>;
  }>('/', async (request, reply) => {
    const db = getDatabase();
    const body = request.body;

    const guardianName = body.guardianName?.trim();

    if (!guardianName) {
      return reply.code(400).send({
        success: false,
        error: 'Guardian name is required',
      });
    }

    const studentIds = body.studentIds ?? [];

    try {
      db.exec('BEGIN');

      const result = db.prepare(`
        INSERT INTO families
        (guardian_name, guardian_phone, address, notes)
        VALUES (?, ?, ?, ?)
      `).run(
        guardianName,
        body.guardianPhone?.trim() || null,
        body.address?.trim() || null,
        body.notes?.trim() || null
      );

      const familyId = Number(result.lastInsertRowid);

      for (const studentId of studentIds) {
        const student = db.prepare(
          'SELECT id FROM students WHERE id = ?'
        ).get(studentId);

        if (!student) {
          throw new Error(`Student not found: ${studentId}`);
        }

        db.prepare(`
          UPDATE students
          SET family_id = ?, updated_at = datetime('now')
          WHERE id = ?
        `).run(familyId, studentId);
      }

      db.exec('COMMIT');

      const family = getFamily(db, familyId)!;

      return reply.code(201).send({
        success: true,
        data: family,
      });
    } catch (error) {
      try {
        if (db.isTransaction) db.exec('ROLLBACK');
      } catch {
        // Ignore rollback errors.
      }
      return reply.code(400).send({
        success: false,
        error: error instanceof Error
          ? error.message
          : 'Unable to create family',
      });
    }
  });

  // PATCH /api/families/:id
  fastify.patch<{
    Params: { id: string };
    Body: {
      guardianName?: string;
      guardianPhone?: string | null;
      address?: string | null;
      notes?: string | null;
      isActive?: boolean;
    };
    Reply: ApiResponse<FamilySummary>;
  }>('/:id', async (request, reply) => {
    const familyId = Number(request.params.id);

    if (!Number.isInteger(familyId) || familyId < 1) {
      return reply.code(400).send({
        success: false,
        error: 'Invalid family id',
      });
    }

    const db = getDatabase();

    if (!db.prepare('SELECT id FROM families WHERE id = ?').get(familyId)) {
      return reply.code(404).send({
        success: false,
        error: 'Family not found',
      });
    }

    const body = request.body;
    const sets: string[] = ["updated_at = datetime('now')"];
    const params: (string | number | null)[] = [];

    if (body.guardianName !== undefined) {
      const name = body.guardianName.trim();

      if (!name) {
        return reply.code(400).send({
          success: false,
          error: 'Guardian name cannot be empty',
        });
      }

      sets.push('guardian_name = ?');
      params.push(name);
    }

    if (body.guardianPhone !== undefined) {
      sets.push('guardian_phone = ?');
      params.push(body.guardianPhone?.trim() || null);
    }

    if (body.address !== undefined) {
      sets.push('address = ?');
      params.push(body.address?.trim() || null);
    }

    if (body.notes !== undefined) {
      sets.push('notes = ?');
      params.push(body.notes?.trim() || null);
    }

    if (body.isActive !== undefined) {
      sets.push('is_active = ?');
      params.push(body.isActive ? 1 : 0);
    }

    if (sets.length === 1) {
      return reply.code(400).send({
        success: false,
        error: 'No fields to update',
      });
    }

    params.push(familyId);

    db.prepare(
      `UPDATE families SET ${sets.join(', ')} WHERE id = ?`
    ).run(...params);

    return reply.send({
      success: true,
      data: getFamily(db, familyId)!,
    });
  });

  // POST /api/families/:id/students
  fastify.post<{
    Params: { id: string };
    Body: { studentId: number };
    Reply: ApiResponse<FamilySummary>;
  }>('/:id/students', async (request, reply) => {
    const familyId = Number(request.params.id);
    const studentId = Number(request.body.studentId);

    if (
      !Number.isInteger(familyId) ||
      familyId < 1 ||
      !Number.isInteger(studentId) ||
      studentId < 1
    ) {
      return reply.code(400).send({
        success: false,
        error: 'Invalid family or student id',
      });
    }

    const db = getDatabase();

    if (!db.prepare('SELECT id FROM families WHERE id = ?').get(familyId)) {
      return reply.code(404).send({
        success: false,
        error: 'Family not found',
      });
    }

    const student = db.prepare(`
      SELECT id, family_id
      FROM students
      WHERE id = ?
    `).get(studentId) as { id: number; family_id: number | null } | undefined;

    if (!student) {
      return reply.code(404).send({
        success: false,
        error: 'Student not found',
      });
    }

    if (student.family_id !== null && student.family_id !== familyId) {
      return reply.code(409).send({
        success: false,
        error: 'Student is already linked to another family',
      });
    }

    if (student.family_id === familyId) {
      return reply.send({
        success: true,
        data: getFamily(db, familyId)!,
      });
    }

    db.prepare(`
      UPDATE students
      SET family_id = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(familyId, studentId);

    return reply.send({
      success: true,
      data: getFamily(db, familyId)!,
    });
  });

  // DELETE /api/families/:id/students/:studentId
  // Unlinks only. Student, fees, payments and attendance are preserved.
  fastify.delete<{
    Params: { id: string; studentId: string };
    Reply: ApiResponse<FamilySummary>;
  }>('/:id/students/:studentId', async (request, reply) => {
    const familyId = Number(request.params.id);
    const studentId = Number(request.params.studentId);

    const db = getDatabase();

    const linked = db.prepare(`
      SELECT id
      FROM students
      WHERE id = ? AND family_id = ?
    `).get(studentId, familyId);

    if (!linked) {
      return reply.code(404).send({
        success: false,
        error: 'Student is not linked to this family',
      });
    }

    db.prepare(`
      UPDATE students
      SET family_id = NULL, updated_at = datetime('now')
      WHERE id = ?
    `).run(studentId);

    return reply.send({
      success: true,
      data: getFamily(db, familyId)!,
    });
  });
}
