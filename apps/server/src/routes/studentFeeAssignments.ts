import type { FastifyInstance } from 'fastify';
import type { ApiResponse } from '@school/shared';
import { getDatabase } from '../db/database.js';
import { requireAdmin } from '../hooks/authenticate.js';

interface StudentFeeAssignment {
  id: number;
  studentId: number;
  studentName: string;
  rollNumber: string;
  classId: number;
  className: string;
  feeStructureId: number;
  feeName: string;
  structureAmount: number;
  amount: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  isActive: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

interface AssignmentRow {
  id: number;
  student_id: number;
  student_name: string;
  roll_number: string;
  class_id: number;
  class_name: string;
  fee_structure_id: number;
  fee_name: string;
  structure_amount: number;
  amount: number;
  effective_from: string;
  effective_to: string | null;
  is_active: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface CreateAssignmentRequest {
  studentId: number;
  feeStructureId: number;
  amount?: number;
  effectiveFrom: string;
  notes?: string | null;
}

interface UpdateAssignmentRequest {
  amount?: number;
  effectiveFrom?: string;
  effectiveTo?: string | null;
  isActive?: boolean;
  notes?: string | null;
}

function toAssignment(row: AssignmentRow): StudentFeeAssignment {
  return {
    id: Number(row.id),
    studentId: Number(row.student_id),
    studentName: row.student_name,
    rollNumber: row.roll_number,
    classId: Number(row.class_id),
    className: row.class_name,
    feeStructureId: Number(row.fee_structure_id),
    feeName: row.fee_name,
    structureAmount: Number(row.structure_amount),
    amount: Number(row.amount),
    effectiveFrom: row.effective_from,
    effectiveTo: row.effective_to,
    isActive: Number(row.is_active) === 1,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function assignmentQuery(): string {
  return `
    SELECT sfa.id,
           sfa.student_id,
           s.full_name AS student_name,
           s.roll_number,
           c.id AS class_id,
           c.name AS class_name,
           sfa.fee_structure_id,
           fs.fee_name,
           fs.amount AS structure_amount,
           sfa.amount,
           sfa.effective_from,
           sfa.effective_to,
           sfa.is_active,
           sfa.notes,
           sfa.created_at,
           sfa.updated_at
    FROM student_fee_assignments sfa
    JOIN students s
      ON s.id = sfa.student_id
    JOIN classes c
      ON c.id = s.class_id
    JOIN fee_structures fs
      ON fs.id = sfa.fee_structure_id
  `;
}

function isValidDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export async function studentFeeAssignmentRoutes(
  fastify: FastifyInstance
) {
  fastify.addHook('preHandler', requireAdmin);

  // GET /api/student-fee-assignments
  fastify.get<{
    Querystring: {
      studentId?: string;
      activeOnly?: string;
    };
    Reply: ApiResponse<StudentFeeAssignment[]>;
  }>(
    '/',
    async (request, reply) => {
      const db = getDatabase();
      const conditions: string[] = [];
      const params: Array<number> = [];

      if (request.query.studentId !== undefined) {
        const studentId = Number(request.query.studentId);

        if (!Number.isInteger(studentId) || studentId < 1) {
          return reply.code(400).send({
            success: false,
            error: 'Invalid studentId.',
          });
        }

        conditions.push('sfa.student_id = ?');
        params.push(studentId);
      }

      if (request.query.activeOnly === 'true') {
        conditions.push('sfa.is_active = 1');
      }

      const where = conditions.length
        ? `WHERE ${conditions.join(' AND ')}`
        : '';

      const rows = db.prepare(
        `${assignmentQuery()}
         ${where}
         ORDER BY s.full_name, sfa.effective_from DESC, sfa.id DESC`
      ).all(...params) as unknown as AssignmentRow[];

      return reply.send({
        success: true,
        data: rows.map(toAssignment),
      });
    }
  );

  // POST /api/student-fee-assignments
  fastify.post<{
    Body: CreateAssignmentRequest;
    Reply: ApiResponse<StudentFeeAssignment>;
  }>(
    '/',
    {
      schema: {
        body: {
          type: 'object',
          required: ['studentId', 'feeStructureId', 'effectiveFrom'],
          properties: {
            studentId: {
              type: 'integer',
              minimum: 1,
            },
            feeStructureId: {
              type: 'integer',
              minimum: 1,
            },
            amount: {
              type: 'integer',
              minimum: 0,
            },
            effectiveFrom: {
              type: 'string',
              pattern: '^\\d{4}-\\d{2}-\\d{2}$',
            },
            notes: {
              anyOf: [
                { type: 'string', maxLength: 500 },
                { type: 'null' },
              ],
            },
          },
        },
      },
    },
    async (request, reply) => {
      const {
        studentId,
        feeStructureId,
        amount,
        effectiveFrom,
        notes = null,
      } = request.body;

      if (!isValidDate(effectiveFrom)) {
        return reply.code(400).send({
          success: false,
          error: 'Effective From must be a valid date in YYYY-MM-DD format.',
        });
      }

      const db = getDatabase();

      const student = db.prepare(
        `SELECT id, class_id, is_active
         FROM students
         WHERE id = ?`
      ).get(studentId) as
        | { id: number; class_id: number; is_active: number }
        | undefined;

      if (!student) {
        return reply.code(404).send({
          success: false,
          error: 'Student not found.',
        });
      }

      if (Number(student.is_active) !== 1) {
        return reply.code(400).send({
          success: false,
          error: 'Cannot assign a fee to an inactive student.',
        });
      }

      const structure = db.prepare(
        `SELECT id, class_id, amount, is_active
         FROM fee_structures
         WHERE id = ?`
      ).get(feeStructureId) as
        | {
            id: number;
            class_id: number;
            amount: number;
            is_active: number;
          }
        | undefined;

      if (!structure || Number(structure.is_active) !== 1) {
        return reply.code(404).send({
          success: false,
          error: 'Fee structure not found or inactive.',
        });
      }

      if (Number(structure.class_id) !== Number(student.class_id)) {
        return reply.code(400).send({
          success: false,
          error: 'Fee structure does not belong to the student class.',
        });
      }

      const finalAmount =
        amount !== undefined
          ? Number(amount)
          : Number(structure.amount);

      if (!Number.isInteger(finalAmount) || finalAmount < 0) {
        return reply.code(400).send({
          success: false,
          error: 'Amount must be a whole number greater than or equal to 0.',
        });
      }

      const existing = db.prepare(
        `SELECT id
         FROM student_fee_assignments
         WHERE student_id = ?
           AND is_active = 1
           AND effective_to IS NULL`
      ).get(studentId);

      if (existing) {
        return reply.code(409).send({
          success: false,
          error: 'This student already has an active recurring fee assignment. Update the existing assignment instead.',
        });
      }

      const result = db.prepare(
        `INSERT INTO student_fee_assignments (
          student_id,
          fee_structure_id,
          amount,
          effective_from,
          notes
        )
        VALUES (?, ?, ?, ?, ?)`
      ).run(
        studentId,
        feeStructureId,
        finalAmount,
        effectiveFrom,
        notes ?? null
      );

      const row = db.prepare(
        `${assignmentQuery()}
         WHERE sfa.id = ?`
      ).get(result.lastInsertRowid as number) as unknown as AssignmentRow;

      return reply.code(201).send({
        success: true,
        data: toAssignment(row),
      });
    }
  );

  // PATCH /api/student-fee-assignments/:id
  fastify.patch<{
    Params: { id: string };
    Body: UpdateAssignmentRequest;
    Reply: ApiResponse<StudentFeeAssignment>;
  }>(
    '/:id',
    {
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: {
              type: 'string',
              pattern: '^[0-9]+$',
            },
          },
        },
        body: {
          type: 'object',
          properties: {
            amount: {
              type: 'integer',
              minimum: 0,
            },
            effectiveFrom: {
              type: 'string',
              pattern: '^\\d{4}-\\d{2}-\\d{2}$',
            },
            effectiveTo: {
              anyOf: [
                {
                  type: 'string',
                  pattern: '^\\d{4}-\\d{2}-\\d{2}$',
                },
                { type: 'null' },
              ],
            },
            isActive: {
              type: 'boolean',
            },
            notes: {
              anyOf: [
                { type: 'string', maxLength: 500 },
                { type: 'null' },
              ],
            },
          },
        },
      },
    },
    async (request, reply) => {
      const id = Number(request.params.id);
      const db = getDatabase();

      const existing = db.prepare(
        `SELECT *
         FROM student_fee_assignments
         WHERE id = ?`
      ).get(id) as
        | {
            id: number;
            amount: number;
            effective_from: string;
            effective_to: string | null;
            is_active: number;
            notes: string | null;
          }
        | undefined;

      if (!existing) {
        return reply.code(404).send({
          success: false,
          error: 'Student fee assignment not found.',
        });
      }

      const amount =
        request.body.amount !== undefined
          ? Number(request.body.amount)
          : Number(existing.amount);

      const effectiveFrom =
        request.body.effectiveFrom !== undefined
          ? request.body.effectiveFrom
          : existing.effective_from;

      const effectiveTo =
        request.body.effectiveTo !== undefined
          ? request.body.effectiveTo
          : existing.effective_to;

      if (!Number.isInteger(amount) || amount < 0) {
        return reply.code(400).send({
          success: false,
          error: 'Amount must be a whole number greater than or equal to 0.',
        });
      }

      if (!isValidDate(effectiveFrom)) {
        return reply.code(400).send({
          success: false,
          error: 'Effective From must be a valid date in YYYY-MM-DD format.',
        });
      }

      if (
        effectiveTo !== null &&
        (!isValidDate(effectiveTo) || effectiveTo < effectiveFrom)
      ) {
        return reply.code(400).send({
          success: false,
          error: 'Effective To must be empty or on/after Effective From.',
        });
      }

      const isActive =
        request.body.isActive !== undefined
          ? request.body.isActive
            ? 1
            : 0
          : Number(existing.is_active);

      if (isActive === 1 && effectiveTo !== null) {
        return reply.code(400).send({
          success: false,
          error: 'An active recurring assignment must have an open-ended Effective To date.',
        });
      }

      const notes =
        request.body.notes !== undefined
          ? request.body.notes
          : existing.notes;

      db.prepare(
        `UPDATE student_fee_assignments
         SET amount = ?,
             effective_from = ?,
             effective_to = ?,
             is_active = ?,
             notes = ?,
             updated_at = datetime('now')
         WHERE id = ?`
      ).run(
        amount,
        effectiveFrom,
        effectiveTo,
        isActive,
        notes ?? null,
        id
      );

      const row = db.prepare(
        `${assignmentQuery()}
         WHERE sfa.id = ?`
      ).get(id) as unknown as AssignmentRow;

      return reply.send({
        success: true,
        data: toAssignment(row),
      });
    }
  );

  // DELETE /api/student-fee-assignments/:id
  // Safe delete: only removes the recurring assignment.
  // Existing student_fees/payment/attendance history is untouched.
  fastify.delete<{
    Params: { id: string };
    Reply: ApiResponse<{ deleted: boolean }>;
  }>(
    '/:id',
    {
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: {
              type: 'string',
              pattern: '^[0-9]+$',
            },
          },
        },
      },
    },
    async (request, reply) => {
      const id = Number(request.params.id);
      const db = getDatabase();

      const existing = db.prepare(
        'SELECT id FROM student_fee_assignments WHERE id = ?'
      ).get(id);

      if (!existing) {
        return reply.code(404).send({
          success: false,
          error: 'Student fee assignment not found.',
        });
      }

      db.prepare(
        'DELETE FROM student_fee_assignments WHERE id = ?'
      ).run(id);

      return reply.send({
        success: true,
        data: { deleted: true },
      });
    }
  );
}
