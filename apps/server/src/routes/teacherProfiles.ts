import type { FastifyInstance } from 'fastify';
import { getDatabase } from '../db/database.js';
import { requireAdmin } from '../hooks/authenticate.js';

function cleanOptionalString(value: unknown, maxLength: number): string | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  if (typeof value !== 'string') {
    throw new Error('Invalid string value');
  }

  const trimmed = value.trim();

  if (trimmed.length > maxLength) {
    throw new Error(`Value exceeds ${maxLength} characters`);
  }

  return trimmed || null;
}

function validateDate(value: string | null): string | null {
  if (value === null) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error('Invalid joining date');
  }
  return value;
}

function validateSalary(value: unknown): number {
  if (value === undefined) return 0;
  if (!Number.isInteger(value) || Number(value) < 0) {
    throw new Error('Invalid monthly salary');
  }
  return Number(value);
}

export async function teacherProfileRoutes(server: FastifyInstance): Promise<void> {
  server.get('/:teacherId', { preHandler: requireAdmin }, async (request, reply) => {
    const teacherId = Number((request.params as { teacherId: string }).teacherId);

    if (!Number.isInteger(teacherId) || teacherId <= 0) {
      return reply.code(400).send({ success: false, error: 'Invalid teacher ID' });
    }

    const db = getDatabase();
    const profile = db.prepare(`
      SELECT
        teacher_id AS teacherId,
        phone,
        email,
        subject,
        joining_date AS joiningDate,
        monthly_salary AS monthlySalary,
        notes,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM teacher_profiles
      WHERE teacher_id = ?
    `).get(teacherId);

    if (!profile) {
      return reply.code(404).send({
        success: false,
        error: 'Teacher profile not found',
      });
    }

    return reply.send({ success: true, data: profile });
  });

  server.post('/:teacherId', { preHandler: requireAdmin }, async (request, reply) => {
    const teacherId = Number((request.params as { teacherId: string }).teacherId);

    if (!Number.isInteger(teacherId) || teacherId <= 0) {
      return reply.code(400).send({ success: false, error: 'Invalid teacher ID' });
    }

    const body = (request.body ?? {}) as {
      phone?: unknown;
      email?: unknown;
      subject?: unknown;
      joiningDate?: unknown;
      monthlySalary?: unknown;
      notes?: unknown;
    };

    try {
      const phone = cleanOptionalString(body.phone, 30);
      const email = cleanOptionalString(body.email, 150);
      const subject = cleanOptionalString(body.subject, 100);
      const joiningDate = validateDate(cleanOptionalString(body.joiningDate, 10));
      const monthlySalary = validateSalary(body.monthlySalary);
      const notes = cleanOptionalString(body.notes, 500);

      const db = getDatabase();

      const teacher = db.prepare(`
        SELECT u.id
        FROM users u
        JOIN roles r ON r.id = u.role_id
        WHERE u.id = ? AND r.name = 'teacher'
      `).get(teacherId);

      if (!teacher) {
        return reply.code(404).send({
          success: false,
          error: 'Teacher not found',
        });
      }

      db.prepare(`
        INSERT INTO teacher_profiles
          (teacher_id, phone, email, subject, joining_date, monthly_salary, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        teacherId,
        phone,
        email,
        subject,
        joiningDate,
        monthlySalary,
        notes,
      );

      const profile = db.prepare(`
        SELECT
          teacher_id AS teacherId,
          phone,
          email,
          subject,
          joining_date AS joiningDate,
          monthly_salary AS monthlySalary,
          notes,
          created_at AS createdAt,
          updated_at AS updatedAt
        FROM teacher_profiles
        WHERE teacher_id = ?
      `).get(teacherId);

      return reply.code(201).send({ success: true, data: profile });
    } catch (error) {
      return reply.code(400).send({
        success: false,
        error: error instanceof Error ? error.message : 'Invalid request',
      });
    }
  });

  server.patch('/:teacherId', { preHandler: requireAdmin }, async (request, reply) => {
    const teacherId = Number((request.params as { teacherId: string }).teacherId);

    if (!Number.isInteger(teacherId) || teacherId <= 0) {
      return reply.code(400).send({ success: false, error: 'Invalid teacher ID' });
    }

    const body = (request.body ?? {}) as {
      phone?: unknown;
      email?: unknown;
      subject?: unknown;
      joiningDate?: unknown;
      monthlySalary?: unknown;
      notes?: unknown;
    };

    try {
      const db = getDatabase();

      const existing = db.prepare(`
        SELECT
          phone,
          email,
          subject,
          joining_date AS joiningDate,
          monthly_salary AS monthlySalary,
          notes
        FROM teacher_profiles
        WHERE teacher_id = ?
      `).get(teacherId) as {
        phone: string | null;
        email: string | null;
        subject: string | null;
        joiningDate: string | null;
        monthlySalary: number;
        notes: string | null;
      } | undefined;

      if (!existing) {
        return reply.code(404).send({
          success: false,
          error: 'Teacher profile not found',
        });
      }

      const phone = body.phone === undefined
        ? existing.phone
        : cleanOptionalString(body.phone, 30);

      const email = body.email === undefined
        ? existing.email
        : cleanOptionalString(body.email, 150);

      const subject = body.subject === undefined
        ? existing.subject
        : cleanOptionalString(body.subject, 100);

      const joiningDate = body.joiningDate === undefined
        ? existing.joiningDate
        : validateDate(cleanOptionalString(body.joiningDate, 10));

      const monthlySalary = body.monthlySalary === undefined
        ? existing.monthlySalary
        : validateSalary(body.monthlySalary);

      const notes = body.notes === undefined
        ? existing.notes
        : cleanOptionalString(body.notes, 500);

      db.prepare(`
        UPDATE teacher_profiles
        SET
          phone = ?,
          email = ?,
          subject = ?,
          joining_date = ?,
          monthly_salary = ?,
          notes = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE teacher_id = ?
      `).run(
        phone,
        email,
        subject,
        joiningDate,
        monthlySalary,
        notes,
        teacherId,
      );

      const profile = db.prepare(`
        SELECT
          teacher_id AS teacherId,
          phone,
          email,
          subject,
          joining_date AS joiningDate,
          monthly_salary AS monthlySalary,
          notes,
          created_at AS createdAt,
          updated_at AS updatedAt
        FROM teacher_profiles
        WHERE teacher_id = ?
      `).get(teacherId);

      return reply.send({ success: true, data: profile });
    } catch (error) {
      return reply.code(400).send({
        success: false,
        error: error instanceof Error ? error.message : 'Invalid request',
      });
    }
  });
}
