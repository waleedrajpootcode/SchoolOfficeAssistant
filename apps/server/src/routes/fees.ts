/**
 * Fees routes
 *
 * Admin only:
 *   GET  /api/fees/structures     — list fee structures
 *   POST /api/fees/structures     — create a fee structure
 *   GET  /api/fees/student-fees   — list student fees
 *   POST /api/fees/student-fees   — create a student fee
 */

import type { FastifyInstance } from 'fastify';
import type {
  ApiResponse,
  FeeStructure,
  CreateFeeStructureRequest,
  StudentFee,
  StudentFeeStatus,
  CreateStudentFeeRequest,
  FeePayment,
  CreateFeePaymentRequest,
  FeeSummary,
} from '@school/shared';
import { getDatabase } from '../db/database.js';
import { requireAdmin } from '../hooks/authenticate.js';

interface FeeStructureRow {
  id: number;
  class_id: number;
  class_name: string;
  fee_name: string;
  amount: number;
  is_active: number;
  created_at: string;
  updated_at: string;
}

interface StudentFeeRow {
  id: number;
  student_id: number;
  student_name: string;
  roll_number: string;
  fee_structure_id: number | null;
  fee_period: string;
  amount_due: number;
  amount_paid: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  due_date: string | null;
  fine_start_date: string | null;
  fine_amount: number;
  fine_waived: number;
  fine_waived_amount: number;
  fine_waived_reason: string | null;
}

interface StudentFeeCreateRow {
  id: number;
  student_id: number;
  student_name: string;
  roll_number: string;
  fee_structure_id: number | null;
  fee_period: string;
  amount_due: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  due_date: string | null;
  fine_start_date: string | null;
  fine_amount: number;
}

interface FeePaymentRow {
  id: number;
  student_fee_id: number;
  amount: number;
  payment_date: string;
  payment_method: 'cash' | 'bank' | 'online' | 'other';
  receipt_number: string;
  received_by: number;
  received_by_name: string;
  notes: string | null;
  created_at: string;
}

function toFeeStructure(row: FeeStructureRow): FeeStructure {
  return {
    id: Number(row.id),
    classId: Number(row.class_id),
    className: row.class_name,
    feeName: row.fee_name,
    amount: Number(row.amount),
    isActive: row.is_active === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}


function isValidFeePeriod(feePeriod: string): boolean {
  if (!/^\d{4}-\d{2}$/.test(feePeriod)) {
    return false;
  }

  const [yearText, monthText] = feePeriod.split("-");
  const year = Number(yearText);
  const month = Number(monthText);

  return (
    Number.isInteger(year) &&
    year >= 2000 &&
    year <= 2100 &&
    Number.isInteger(month) &&
    month >= 1 &&
    month <= 12
  );
}

function materializeMonthlyFees(
  feePeriod: string
): void {
  const db = getDatabase();

  if (!isValidFeePeriod(feePeriod)) {
    throw new Error("Invalid fee period. Use YYYY-MM format.");
  }

  const assignments = db.prepare(
    `SELECT
       sfa.id,
       sfa.student_id,
       sfa.fee_structure_id,
       sfa.amount,
       sfa.effective_from,
       sfa.effective_to,
       fs.amount AS structure_amount
     FROM student_fee_assignments sfa
     JOIN students s
       ON s.id = sfa.student_id
     JOIN fee_structures fs
       ON fs.id = sfa.fee_structure_id
     WHERE sfa.is_active = 1
       AND s.is_active = 1
       AND sfa.effective_from <= ?
       AND (
         sfa.effective_to IS NULL
         OR sfa.effective_to >= ?
       )`
  ).all(
    `${feePeriod}-01`,
    `${feePeriod}-01`
  ) as unknown as Array<{
    id: number;
    student_id: number;
    fee_structure_id: number;
    amount: number;
    effective_from: string;
    effective_to: string | null;
    structure_amount: number;
  }>;

  const [yearText, monthText] = feePeriod.split("-");
  const year = Number(yearText);
  const month = Number(monthText);

  const daysInMonth = new Date(
    Date.UTC(year, month, 0)
  ).getUTCDate();

  const clampDay = (
    day: number | null | undefined
  ) =>
    day == null
      ? null
      : Math.min(
          Math.max(Number(day), 1),
          daysInMonth
        );

  const insert = db.prepare(
    `INSERT OR IGNORE INTO student_fees
      (
        student_id,
        fee_structure_id,
        fee_period,
        amount_due,
        notes,
        due_date,
        fine_start_date,
        fine_amount
      )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );

  for (const assignment of assignments) {
    const existing = db.prepare(
      `SELECT id
       FROM student_fees
       WHERE student_id = ?
         AND fee_period = ?`
    ).get(
      assignment.student_id,
      feePeriod
    );

    if (existing) {
      continue;
    }

    const rule = db.prepare(
      `SELECT
         last_date_day,
         fine_start_day,
         fine_amount
       FROM fee_rules
       WHERE fee_structure_id = ?
         AND is_active = 1`
    ).get(
      assignment.fee_structure_id
    ) as
      | {
          last_date_day: number | null;
          fine_start_day: number | null;
          fine_amount: number;
        }
      | undefined;

    const lastDateDay = clampDay(
      rule?.last_date_day
    );

    const fineStartDay =
      lastDateDay == null
        ? null
        : clampDay(rule?.fine_start_day);

    const dueDate =
      lastDateDay == null
        ? null
        : `${feePeriod}-${String(
            lastDateDay
          ).padStart(2, "0")}`;

    const fineStartDate =
      fineStartDay == null
        ? null
        : `${feePeriod}-${String(
            fineStartDay
          ).padStart(2, "0")}`;

    const fineAmount = Math.max(
      0,
      Number(rule?.fine_amount ?? 0)
    );

    insert.run(
      assignment.student_id,
      assignment.fee_structure_id,
      feePeriod,
      Math.max(0, Number(assignment.amount)),
      `Recurring fee plan #${assignment.id}`,
      dueDate,
      fineStartDate,
      fineAmount
    );
  }
}

function toStudentFee(row: StudentFeeRow): StudentFee {
  const amountDue = Number(row.amount_due);
  const amountPaid = Number(row.amount_paid);
  const amountRemaining = Math.max(0, amountDue - amountPaid);

  const fineAmount = Math.max(0, Number(row.fine_amount ?? 0));
  const fineWaived = Boolean(row.fine_waived);
  const fineWaivedAmount = Math.max(
    0,
    Number(row.fine_waived_amount ?? 0)
  );

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let fineApplicable = false;

  if (
    fineAmount > 0 &&
    row.fine_start_date &&
    amountRemaining > 0
  ) {
    const fineStartDate = new Date(`${row.fine_start_date}T00:00:00`);
    fineApplicable = today >= fineStartDate;
  }

  const effectiveFine = fineApplicable
    ? Math.max(0, fineAmount - fineWaivedAmount)
    : 0;

  const appliedFine = effectiveFine;
  const totalPayable = amountDue + appliedFine;
  const totalRemaining = Math.max(0, totalPayable - amountPaid);

  let status: StudentFeeStatus = 'unpaid';

  if (amountPaid >= amountDue) {
    status = 'paid';
  } else if (amountPaid > 0) {
    status = 'partial';
  }

  let effectiveStatus: StudentFeeStatus | 'overdue' = status;
  let daysOverdue = 0;

  if (totalRemaining > 0 && row.due_date) {
    const dueDate = new Date(`${row.due_date}T00:00:00`);

    if (dueDate < today) {
      effectiveStatus = 'overdue';
      daysOverdue = Math.floor(
        (today.getTime() - dueDate.getTime()) / 86400000
      );
    }
  }

  return {
    id: Number(row.id),
    studentId: Number(row.student_id),
    studentName: row.student_name,
    rollNumber: row.roll_number,
    feeStructureId:
      row.fee_structure_id === null
        ? null
        : Number(row.fee_structure_id),
    feePeriod: row.fee_period,
    amountDue,
    amountPaid,
    amountRemaining,
    status,
    effectiveStatus,
    dueDate: row.due_date,
    fineStartDate: row.fine_start_date,
    fineAmount,
    fineWaived: Boolean(row.fine_waived),
    fineWaivedAmount: Number(row.fine_waived_amount ?? 0),
    fineWaivedReason: row.fine_waived_reason ?? null,
    fineApplicable,
    appliedFine,
    totalPayable,
    totalRemaining,
    daysOverdue,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function feeRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', requireAdmin);

  // ── GET /api/fees/structures ──────────────────────────────────────────────
  fastify.get<{
    Reply: ApiResponse<FeeStructure[]>;
  }>(
    '/structures',
    async (_request, reply) => {
      const db = getDatabase();

      const rows = db.prepare(
        `SELECT fs.id,
                fs.class_id,
                c.name AS class_name,
                fs.fee_name,
                fs.amount,
                fs.is_active,
                fs.created_at,
                fs.updated_at
         FROM fee_structures fs
         JOIN classes c ON c.id = fs.class_id
         ORDER BY c.name, fs.fee_name`
      ).all() as unknown as FeeStructureRow[];

      return reply.send({
        success: true,
        data: rows.map(toFeeStructure),
      });
    }
  );

  // ── POST /api/fees/structures ─────────────────────────────────────────────
  fastify.post<{
    Body: CreateFeeStructureRequest;
    Reply: ApiResponse<FeeStructure>;
  }>(
    '/structures',
    {
      schema: {
        body: {
          type: 'object',
          required: ['classId', 'feeName', 'amount'],
          properties: {
            classId: {
              type: 'integer',
              minimum: 1,
            },
            feeName: {
              type: 'string',
              minLength: 1,
              maxLength: 100,
            },
            amount: {
              type: 'integer',
              minimum: 0,
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { classId, feeName, amount } = request.body;
      const db = getDatabase();

      // Class must exist and be active.
      const cls = db.prepare(
        'SELECT id FROM classes WHERE id = ? AND is_active = 1'
      ).get(classId);

      if (!cls) {
        return reply.code(400).send({
          success: false,
          error: 'Class not found or inactive',
        });
      }

      // One fee name can exist only once per class.
      const duplicate = db.prepare(
        'SELECT id FROM fee_structures WHERE class_id = ? AND fee_name = ?'
      ).get(classId, feeName);

      if (duplicate) {
        return reply.code(409).send({
          success: false,
          error: 'Fee structure already exists for this class',
        });
      }

      const result = db.prepare(
        `INSERT INTO fee_structures (class_id, fee_name, amount)
         VALUES (?, ?, ?)`
      ).run(classId, feeName, amount);

      const newRow = db.prepare(
        `SELECT fs.id,
                fs.class_id,
                c.name AS class_name,
                fs.fee_name,
                fs.amount,
                fs.is_active,
                fs.created_at,
                fs.updated_at
         FROM fee_structures fs
         JOIN classes c ON c.id = fs.class_id
         WHERE fs.id = ?`
      ).get(result.lastInsertRowid as number) as unknown as FeeStructureRow;

      return reply.code(201).send({
        success: true,
        data: toFeeStructure(newRow),
      });
    }
  );
    // ── GET /api/fees/summary ─────────────────────────────────────────────────
  fastify.get<{
    Reply: ApiResponse<FeeSummary>;
  }>(
    '/summary',
    async (_request, reply) => {
      const db = getDatabase();

      const row = db.prepare(`
        SELECT
          COALESCE(SUM(sf.amount_due), 0) AS total_due,
          COALESCE(SUM(
            (
              SELECT COALESCE(SUM(fp.amount), 0)
              FROM fee_payments fp
              WHERE fp.student_fee_id = sf.id
            )
          ), 0) AS total_paid,
          COALESCE(SUM(
            CASE WHEN sf.status = 'unpaid' THEN 1 ELSE 0 END
          ), 0) AS unpaid_count,
          COALESCE(SUM(
            CASE WHEN sf.status = 'partial' THEN 1 ELSE 0 END
          ), 0) AS partial_count,
          COALESCE(SUM(
            CASE WHEN sf.status = 'paid' THEN 1 ELSE 0 END
          ), 0) AS paid_count,
          COALESCE(SUM(
            CASE
              WHEN sf.due_date < date('now')
               AND sf.amount_due > (
                 SELECT COALESCE(SUM(fp2.amount), 0)
                 FROM fee_payments fp2
                 WHERE fp2.student_fee_id = sf.id
               )
              THEN 1
              ELSE 0
            END
          ), 0) AS overdue_count,
          COALESCE(SUM(
            CASE
              WHEN sf.due_date < date('now')
              THEN MAX(
                0,
                sf.amount_due - (
                  SELECT COALESCE(SUM(fp3.amount), 0)
                  FROM fee_payments fp3
                  WHERE fp3.student_fee_id = sf.id
                )
              )
              ELSE 0
            END
          ), 0) AS overdue_amount
        FROM student_fees sf
      `).get() as {
        total_due: number;
        total_paid: number;
        unpaid_count: number;
        partial_count: number;
        paid_count: number;
        overdue_count: number;
        overdue_amount: number;
      };

      const summary: FeeSummary = {
        totalDue: Number(row.total_due),
        totalPaid: Number(row.total_paid),
        totalRemaining:
          Number(row.total_due) - Number(row.total_paid),
        unpaidCount: Number(row.unpaid_count),
        partialCount: Number(row.partial_count),
        paidCount: Number(row.paid_count),
        overdueCount: Number(row.overdue_count),
        overdueAmount: Number(row.overdue_amount),
      };

      return reply.send({
        success: true,
        data: summary,
      });
    }
  );


  // ── GET /api/fees/student-fees ────────────────────────────────────────────
  fastify.post<{
    Body: {
      period: string;
    };
    Reply: ApiResponse<{
      period: string;
      createdCount: number;
    }>;
  }>(
    '/student-fees/materialize',
    async (request, reply) => {
      const period = request.body.period?.trim();

      if (!period || !isValidFeePeriod(period)) {
        return reply.code(400).send({
          success: false,
          error: 'Invalid fee period. Use YYYY-MM format',
        });
      }

      try {
        const db = getDatabase();

        const beforeRow = db.prepare(
          `SELECT COUNT(*) AS count
           FROM student_fees
           WHERE fee_period = ?`
        ).get(period) as { count: number } | undefined;

        const before = Number(beforeRow?.count ?? 0);

        materializeMonthlyFees(period);

        const afterRow = db.prepare(
          `SELECT COUNT(*) AS count
           FROM student_fees
           WHERE fee_period = ?`
        ).get(period) as { count: number } | undefined;

        const after = Number(afterRow?.count ?? 0);

        return reply.code(200).send({
          success: true,
          data: {
            period,
            createdCount: Math.max(0, after - before),
          },
        });
      } catch (error) {
        return reply.code(500).send({
          success: false,
          error:
            error instanceof Error
              ? error.message
              : 'Failed to materialize monthly fees',
        });
      }
    }
  );

  fastify.get<{
    Reply: ApiResponse<string[]>;
  }>(
    '/student-fee-periods',
    async (_request, reply) => {
      const db = getDatabase();

      const rows = db.prepare(`
        SELECT DISTINCT fee_period
        FROM student_fees
        WHERE fee_period IS NOT NULL
          AND fee_period <> ''
        ORDER BY fee_period DESC
      `).all() as Array<{ fee_period: string }>;

      return reply.send({
        success: true,
        data: rows.map((row) => row.fee_period),
      });
    }
  );

  fastify.get<{
    Querystring: {
      studentId?: string;
      period?: string;
      status?: string;
    };
    Reply: ApiResponse<StudentFee[]>;
  }>(
    '/student-fees',
    async (request, reply) => {
      const db = getDatabase();

      const requestedPeriod =
        request.query.period?.trim() ||
        (() => {
          const now = new Date();
          return `${now.getFullYear()}-${String(
            now.getMonth() + 1
          ).padStart(2, '0')}`;
        })();

      if (!isValidFeePeriod(requestedPeriod)) {
        return reply.code(400).send({
          success: false,
          error: 'Invalid fee period. Use YYYY-MM format',
        });
      }

      const now = new Date();
      const currentPeriod = `${now.getFullYear()}-${String(
        now.getMonth() + 1
      ).padStart(2, '0')}`;

      if (requestedPeriod === currentPeriod) {
        try {
          materializeMonthlyFees(requestedPeriod);
        } catch (error) {
          return reply.code(500).send({
            success: false,
            error:
              error instanceof Error
                ? error.message
                : 'Failed to prepare current-month fees',
          });
        }
      }

      const rows = db.prepare(
        `SELECT sf.id,
                sf.student_id,
                s.full_name AS student_name,
                s.roll_number,
                sf.fee_structure_id,
                sf.fee_period,
                sf.amount_due,
                COALESCE(SUM(fp.amount), 0) AS amount_paid,
                sf.notes,
                sf.created_at,
                sf.updated_at,
                sf.due_date,
                sf.fine_start_date,
                sf.fine_amount,
                sf.fine_waived,
                sf.fine_waived_amount,
                sf.fine_waived_reason
         FROM student_fees sf
         JOIN students s ON s.id = sf.student_id
         LEFT JOIN fee_payments fp ON fp.student_fee_id = sf.id
         WHERE sf.fee_period = ?
         GROUP BY sf.id
         ORDER BY s.roll_number`
      ).all(requestedPeriod) as unknown as StudentFeeRow[];

      const studentId = request.query.studentId
        ? Number(request.query.studentId)
        : null;

      const filteredRows =
        Number.isInteger(studentId) && studentId && studentId > 0
          ? rows.filter(
              (row) =>
                Number(row.student_id) === studentId
            )
          : rows;

      return reply.send({
        success: true,
        data: filteredRows.map(toStudentFee),
      });
    }
  );

  // ── POST /api/fees/student-fees ───────────────────────────────────────────
  // ?? GET /api/fees/students/:studentId/outstanding ?????????????????????????
  fastify.get<{
    Params: {
      studentId: string;
    };
    Reply: ApiResponse<{
      studentId: number;
      studentName: string;
      rollNumber: string;
      guardianName: string | null;
      totalOutstanding: number;
      fees: Array<{
        studentFeeId: number;
        feePeriod: string;
        amountDue: number;
        amountPaid: number;
        fineAmount: number;
        fineWaivedAmount: number;
        effectiveFine: number;
        totalPayable: number;
        remaining: number;
        dueDate: string | null;
      }>;
    }>;
  }>(
    '/students/:studentId/outstanding',
    async (request, reply) => {
      const studentId = Number(request.params.studentId);

      if (!Number.isInteger(studentId) || studentId <= 0) {
        return reply.code(400).send({
          success: false,
          error: 'Invalid student id',
        });
      }

      const db = getDatabase();

      const student = db.prepare(
        `SELECT
           id,
           full_name,
           roll_number,
           guardian_name
         FROM students
         WHERE id = ?
           AND is_active = 1`
      ).get(studentId) as
        | {
            id: number;
            full_name: string;
            roll_number: string;
            guardian_name: string | null;
          }
        | undefined;

      if (!student) {
        return reply.code(404).send({
          success: false,
          error: 'Active student not found',
        });
      }

      const rows = db.prepare(
        `SELECT
           sf.id AS student_fee_id,
           sf.fee_period,
           sf.amount_due,
           COALESCE(SUM(fp.amount), 0) AS amount_paid,
           sf.fine_amount,
           sf.fine_waived,
           sf.fine_waived_amount,
           sf.due_date,
           sf.fine_start_date
         FROM student_fees sf
         LEFT JOIN fee_payments fp
           ON fp.student_fee_id = sf.id
         WHERE sf.student_id = ?
           AND sf.fee_period <= strftime('%Y-%m', 'now', 'localtime')
         GROUP BY sf.id
         ORDER BY sf.fee_period ASC, sf.id ASC`
      ).all(studentId) as Array<{
        student_fee_id: number;
        fee_period: string;
        amount_due: number;
        amount_paid: number;
        fine_amount: number;
        fine_waived: number;
        fine_waived_amount: number;
        due_date: string | null;
        fine_start_date: string | null;
      }>;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const fees = rows
        .map((row) => {
          const amountDue = Math.max(0, Number(row.amount_due));
          const amountPaid = Math.max(0, Number(row.amount_paid));
          const fineAmount = Math.max(0, Number(row.fine_amount ?? 0));
          const fineWaivedAmount = Math.min(
            fineAmount,
            Math.max(0, Number(row.fine_waived_amount ?? 0))
          );

          let fineApplicable = false;

          if (
            fineAmount > 0 &&
            row.fine_start_date &&
            amountDue - amountPaid > 0
          ) {
            const fineStartDate = new Date(
              `${row.fine_start_date}T00:00:00`
            );
            fineApplicable = today >= fineStartDate;
          }

          const effectiveFine = fineApplicable
            ? Math.max(0, fineAmount - fineWaivedAmount)
            : 0;

          const totalPayable = amountDue + effectiveFine;
          const remaining = Math.max(
            0,
            totalPayable - amountPaid
          );

          return {
            studentFeeId: Number(row.student_fee_id),
            feePeriod: row.fee_period,
            amountDue,
            amountPaid,
            fineAmount,
            fineWaivedAmount,
            effectiveFine,
            totalPayable,
            remaining,
            dueDate: row.due_date,
          };
        })
        .filter((fee) => fee.remaining > 0);

      const totalOutstanding = fees.reduce(
        (sum, fee) => sum + fee.remaining,
        0
      );

      return reply.send({
        success: true,
        data: {
          studentId: Number(student.id),
          studentName: student.full_name,
          rollNumber: student.roll_number,
          guardianName: student.guardian_name,
          totalOutstanding,
          fees,
        },
      });
    }
  );

  fastify.post<{
    Body: CreateStudentFeeRequest;
    Reply: ApiResponse<StudentFee>;
  }>(
    '/student-fees',
    {
      schema: {
        body: {
          type: 'object',
          required: ['studentId', 'feeStructureId', 'feePeriod'],
          properties: {
            studentId: {
              type: 'integer',
              minimum: 1,
            },
            feeStructureId: {
              type: 'integer',
              minimum: 1,
            },
            feePeriod: {
              type: 'string',
              pattern: '^\\d{4}-\\d{2}$',
            },
            notes: {
              type: 'string',
              maxLength: 500,
            },
          },
        },
      },
    },
    async (request, reply) => {
      const {
        studentId,
        feeStructureId,
        feePeriod,
        notes,
      } = request.body;

      const db = getDatabase();

      if (feeStructureId === undefined) {
        return reply.code(400).send({
          success: false,
          error: 'Fee structure is required',
        });
      }

      const selectedFeeStructureId = Number(feeStructureId);

      const student = db.prepare(
        'SELECT id FROM students WHERE id = ? AND is_active = 1'
      ).get(studentId);

      if (!student) {
        return reply.code(400).send({
          success: false,
          error: 'Student not found or inactive',
        });
      }

      const structure = db.prepare(
        `SELECT id, amount
         FROM fee_structures
         WHERE id = ? AND is_active = 1`
      ).get(selectedFeeStructureId) as
        | { id: number; amount: number }
        | undefined;

      if (!structure) {
        return reply.code(400).send({
          success: false,
          error: 'Fee structure not found or inactive',
        });
      }

      const rule = db.prepare(
        `SELECT last_date_day,
                fine_start_day,
                fine_amount
         FROM fee_rules
         WHERE fee_structure_id = ?
           AND is_active = 1`
      ).get(selectedFeeStructureId) as
        | {
            last_date_day: number | null;
            fine_start_day: number | null;
            fine_amount: number;
          }
        | undefined;

      const [yearText, monthText] = feePeriod.split('-');
      const year = Number(yearText);
      const month = Number(monthText);

      const daysInMonth = new Date(
        Date.UTC(year, month, 0)
      ).getUTCDate();

      const clampDay = (day: number | null | undefined) =>
        day == null ? null : Math.min(Math.max(Number(day), 1), daysInMonth);

      const lastDateDay = clampDay(rule?.last_date_day);
      const fineStartDay =
        lastDateDay == null
          ? null
          : clampDay(rule?.fine_start_day);

      const dueDate =
        lastDateDay == null
          ? null
          : `${feePeriod}-${String(lastDateDay).padStart(2, '0')}`;

      const fineStartDate =
        fineStartDay == null
          ? null
          : `${feePeriod}-${String(fineStartDay).padStart(2, '0')}`;

      const fineAmount = Math.max(0, Number(rule?.fine_amount ?? 0));

      const duplicate = db.prepare(
        'SELECT id FROM student_fees WHERE student_id = ? AND fee_period = ?'
      ).get(studentId, feePeriod);

      if (duplicate) {
        return reply.code(409).send({
          success: false,
          error: 'Student fee already exists for this period',
        });
      }

      const result = db.prepare(
        `INSERT INTO student_fees
          (student_id, fee_structure_id, fee_period, amount_due, notes, due_date,
           fine_start_date, fine_amount)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        studentId,
        selectedFeeStructureId,
        feePeriod,
        Number(structure.amount),
        notes ?? null,
        dueDate,
        fineStartDate,
        fineAmount
      );

      const row = db.prepare(
        `SELECT sf.id,
                sf.student_id,
                s.full_name AS student_name,
                s.roll_number,
                sf.fee_structure_id,
                sf.fee_period,
                sf.amount_due,
                sf.notes,
                sf.created_at,
                sf.updated_at,
                sf.due_date,
                sf.fine_start_date,
                sf.fine_amount
         FROM student_fees sf
         JOIN students s ON s.id = sf.student_id
         WHERE sf.id = ?`
      ).get(result.lastInsertRowid as number) as unknown as StudentFeeCreateRow;

      const createdAmountDue = Number(row.amount_due);
      const createdFineAmount = Number(row.fine_amount ?? 0);

      const data: StudentFee = {
        id: Number(row.id),
        studentId: Number(row.student_id),
        studentName: row.student_name,
        rollNumber: row.roll_number,
        feeStructureId:
          row.fee_structure_id === null
            ? null
            : Number(row.fee_structure_id),
        feePeriod: row.fee_period,
        amountDue: createdAmountDue,
        amountPaid: 0,
        amountRemaining: createdAmountDue,
        status: 'unpaid',
        effectiveStatus: 'unpaid',
        dueDate: row.due_date,
        fineStartDate: row.fine_start_date,
        fineAmount: createdFineAmount,
        fineWaived: false,
        fineWaivedAmount: 0,
        fineWaivedReason: null,
        fineApplicable: false,
        appliedFine: 0,
        totalPayable: createdAmountDue,
        totalRemaining: createdAmountDue,
        daysOverdue: 0,
        notes: row.notes,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };

      return reply.code(201).send({
        success: true,
        data,
      });
    }
  );

  // ?? POST /api/fees/student-payments ???????????????????????????????????????
  // Receives one student payment and automatically allocates it oldest-due-first.
  // All fee-payment rows are committed atomically.
  fastify.post<{
    Body: {
      studentId: number;
      amount: number;
      paymentDate: string;
      paymentMethod: 'cash' | 'bank' | 'online' | 'other';
      notes?: string | null;
    };
    Reply: ApiResponse<{
      studentId: number;
      studentName: string;
      receiptNumber: string;
      totalAmount: number;
      paymentDate: string;
      paymentMethod: 'cash' | 'bank' | 'online' | 'other';
      allocations: Array<{
        paymentId: number;
        studentFeeId: number;
        feePeriod: string;
        amount: number;
      }>;
    }>;
  }>(
    '/student-payments',
    {
      schema: {
        body: {
          type: 'object',
          required: [
            'studentId',
            'amount',
            'paymentDate',
            'paymentMethod',
          ],
          properties: {
            studentId: { type: 'integer', minimum: 1 },
            amount: { type: 'integer', minimum: 1 },
            paymentDate: {
              type: 'string',
              pattern: '^\\d{4}-\\d{2}-\\d{2}$',
            },
            paymentMethod: {
              type: 'string',
              enum: ['cash', 'bank', 'online', 'other'],
            },
            notes: {
              anyOf: [
                { type: 'string', maxLength: 500 },
                { type: 'null' },
              ],
            },
          },
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      const {
        studentId,
        amount,
        paymentDate,
        paymentMethod,
        notes,
      } = request.body;

      if (!Number.isInteger(studentId) || studentId <= 0) {
        return reply.code(400).send({
          success: false,
          error: 'Invalid student id',
        });
      }

      if (!Number.isInteger(amount) || amount <= 0) {
        return reply.code(400).send({
          success: false,
          error: 'Payment amount must be greater than zero',
        });
      }

      if (!/^\d{4}-\d{2}-\d{2}$/.test(paymentDate)) {
        return reply.code(400).send({
          success: false,
          error: 'Invalid payment date. Use YYYY-MM-DD.',
        });
      }

      const db = getDatabase();

      const student = db.prepare(`
        SELECT id, full_name, is_active
        FROM students
        WHERE id = ?
      `).get(studentId) as
        | {
            id: number;
            full_name: string;
            is_active: number;
          }
        | undefined;

      if (!student || student.is_active !== 1) {
        return reply.code(404).send({
          success: false,
          error: 'Active student not found',
        });
      }

      const now = new Date();
      const currentPeriod =
        `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

      const rows = db.prepare(`
        SELECT
          sf.id AS student_fee_id,
          sf.fee_period,
          sf.amount_due,
          COALESCE(SUM(fp.amount), 0) AS amount_paid,
          sf.fine_amount,
          sf.fine_waived_amount,
          sf.fine_start_date
        FROM student_fees sf
        LEFT JOIN fee_payments fp
          ON fp.student_fee_id = sf.id
        WHERE sf.student_id = ?
          AND sf.fee_period <= ?
        GROUP BY sf.id
        ORDER BY sf.fee_period ASC, sf.id ASC
      `).all(studentId, currentPeriod) as Array<{
        student_fee_id: number;
        fee_period: string;
        amount_due: number;
        amount_paid: number;
        fine_amount: number;
        fine_waived_amount: number;
        fine_start_date: string | null;
      }>;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const outstanding = rows
        .map((row) => {
          const amountDue = Math.max(0, Number(row.amount_due));
          const amountPaid = Math.max(0, Number(row.amount_paid));
          const fineAmount = Math.max(0, Number(row.fine_amount ?? 0));
          const waivedAmount = Math.min(
            fineAmount,
            Math.max(0, Number(row.fine_waived_amount ?? 0))
          );

          let fineApplicable = false;

          if (
            fineAmount > 0 &&
            row.fine_start_date &&
            amountDue - amountPaid > 0
          ) {
            const fineStartDate = new Date(
              `${row.fine_start_date}T00:00:00`
            );
            fineApplicable = today >= fineStartDate;
          }

          const effectiveFine = fineApplicable
            ? Math.max(0, fineAmount - waivedAmount)
            : 0;

          const totalPayable = amountDue + effectiveFine;
          const remaining = Math.max(
            0,
            totalPayable - amountPaid
          );

          return {
            studentFeeId: Number(row.student_fee_id),
            feePeriod: row.fee_period,
            remaining,
          };
        })
        .filter((fee) => fee.remaining > 0);

      const totalOutstanding = outstanding.reduce(
        (sum, fee) => sum + fee.remaining,
        0
      );

      if (totalOutstanding <= 0) {
        return reply.code(400).send({
          success: false,
          error: 'Student has no outstanding fee balance',
        });
      }

      if (amount > totalOutstanding) {
        return reply.code(400).send({
          success: false,
          error: `Payment exceeds outstanding balance of ${totalOutstanding}`,
        });
      }

      let remainingPayment = amount;

      const allocations = outstanding
        .map((fee) => {
          if (remainingPayment <= 0) return null;

          const allocationAmount = Math.min(
            remainingPayment,
            fee.remaining
          );

          remainingPayment -= allocationAmount;

          return {
            ...fee,
            amount: allocationAmount,
          };
        })
        .filter(
          (
            allocation
          ): allocation is {
            studentFeeId: number;
            feePeriod: string;
            remaining: number;
            amount: number;
          } => allocation !== null && allocation.amount > 0
        );

      if (remainingPayment !== 0 || allocations.length === 0) {
        return reply.code(400).send({
          success: false,
          error: 'Unable to allocate payment safely',
        });
      }

      const receiptSequence = db.prepare(`
        SELECT receipt_number
        FROM fee_payments
        WHERE receipt_number GLOB '[0-9]*'
        ORDER BY CAST(receipt_number AS INTEGER) DESC
        LIMIT 1
      `).get() as
        | { receipt_number?: string }
        | undefined;

      const nextReceipt =
        Number(receiptSequence?.receipt_number ?? 0) + 1;

      const receiptNumber =
        String(nextReceipt).padStart(4, '0');

      db.exec('BEGIN');

      try {
        const paymentRows: Array<{
          paymentId: number;
          studentFeeId: number;
          feePeriod: string;
          amount: number;
        }> = [];

        for (const allocation of allocations) {
          const result = db.prepare(`
            INSERT INTO fee_payments
              (
                student_fee_id,
                amount,
                payment_date,
                payment_method,
                receipt_number,
                received_by,
                notes
              )
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `).run(
            allocation.studentFeeId,
            allocation.amount,
            paymentDate,
            paymentMethod,
            `${receiptNumber}-${allocation.studentFeeId}`,
            request.user!.id,
            notes ?? null
          );

          const paidRow = db.prepare(`
            SELECT COALESCE(SUM(amount), 0) AS amount_paid
            FROM fee_payments
            WHERE student_fee_id = ?
          `).get(allocation.studentFeeId) as {
            amount_paid: number;
          };

          const feeRow = db.prepare(`
            SELECT
              amount_due,
              fine_amount,
              fine_waived_amount,
              fine_start_date
            FROM student_fees
            WHERE id = ?
          `).get(allocation.studentFeeId) as {
            amount_due: number;
            fine_amount: number;
            fine_waived_amount: number;
            fine_start_date: string | null;
          };

          const amountPaid = Number(paidRow.amount_paid ?? 0);
          const amountDue = Math.max(0, Number(feeRow.amount_due));
          const fineAmount = Math.max(0, Number(feeRow.fine_amount ?? 0));
          const waivedAmount = Math.min(
            fineAmount,
            Math.max(0, Number(feeRow.fine_waived_amount ?? 0))
          );

          let fineApplicable = false;

          if (
            fineAmount > 0 &&
            feeRow.fine_start_date &&
            amountDue - amountPaid > 0
          ) {
            const fineStartDate = new Date(
              `${feeRow.fine_start_date}T00:00:00`
            );
            fineApplicable = today >= fineStartDate;
          }

          const effectiveFine = fineApplicable
            ? Math.max(0, fineAmount - waivedAmount)
            : 0;

          const totalPayable = amountDue + effectiveFine;

          const status =
            amountPaid >= totalPayable
              ? 'paid'
              : amountPaid > 0
                ? 'partial'
                : 'unpaid';

          db.prepare(`
            UPDATE student_fees
            SET
              status = ?,
              updated_at = datetime('now')
            WHERE id = ?
          `).run(status, allocation.studentFeeId);

          paymentRows.push({
            paymentId: Number(result.lastInsertRowid),
            studentFeeId: allocation.studentFeeId,
            feePeriod: allocation.feePeriod,
            amount: allocation.amount,
          });
        }

        db.exec('COMMIT');

        return reply.code(201).send({
          success: true,
          data: {
            studentId: Number(student.id),
            studentName: student.full_name,
            receiptNumber,
            totalAmount: amount,
            paymentDate,
            paymentMethod,
            allocations: paymentRows,
          },
        });
      } catch (error) {
        try {
          db.exec('ROLLBACK');
        } catch {
          // Preserve original error.
        }
        throw error;
      }
    }
  );

  // ── POST /api/fees/payments ────────────────────────────────────────────────
  fastify.post<{
    Body: CreateFeePaymentRequest;
    Reply: ApiResponse<FeePayment>;
  }>(
    '/payments',
    {
      schema: {
        body: {
          type: 'object',
          required: [
            'studentFeeId',
            'amount',
            'paymentDate',
            'paymentMethod',
          ],
          properties: {
            studentFeeId: {
              type: 'integer',
              minimum: 1,
            },
            amount: {
              type: 'integer',
              minimum: 1,
            },
            paymentDate: {
              type: 'string',
              pattern: '^\\d{4}-\\d{2}-\\d{2}$',
            },
            paymentMethod: {
              type: 'string',
              enum: ['cash', 'bank', 'online', 'other'],
            },
            notes: {
              type: 'string',
              maxLength: 500,
            },
          },
        },
      },
    },
    async (request, reply) => {
      const {
        studentFeeId,
        amount,
        paymentDate,
        paymentMethod,
        notes,
      } = request.body;

      const db = getDatabase();

      const studentFee = db.prepare(
        `SELECT
           id,
           amount_due,
           due_date,
           fine_start_date,
           fine_amount,
           fine_waived,
           fine_waived_amount
         FROM student_fees
         WHERE id = ?`
      ).get(studentFeeId) as
        | {
            id: number;
            amount_due: number;
            due_date: string | null;
            fine_start_date: string | null;
            fine_amount: number;
            fine_waived: number;
            fine_waived_amount: number;
          }
        | undefined;

      if (!studentFee) {
        return reply.code(404).send({
          success: false,
          error: 'Student fee not found',
        });
      }

      const paymentTotal = db.prepare(
        `SELECT COALESCE(SUM(amount), 0) AS amount_paid
         FROM fee_payments
         WHERE student_fee_id = ?`
      ).get(studentFeeId) as unknown as { amount_paid: number };

      const amountPaid = Number(paymentTotal.amount_paid);
      const amountDue = Number(studentFee.amount_due);
      const fineAmount = Math.max(0, Number(studentFee.fine_amount ?? 0));
      const fineWaivedAmount = Math.max(
        0,
        Number(studentFee.fine_waived_amount ?? 0)
      );

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      let fineApplicable = false;

      if (
        fineAmount > 0 &&
        studentFee.fine_start_date &&
        Math.max(0, amountDue - amountPaid) > 0
      ) {
        const fineStartDate = new Date(
          `${studentFee.fine_start_date}T00:00:00`
        );
        fineApplicable = today >= fineStartDate;
      }

      const effectiveFine = fineApplicable
        ? Math.max(0, fineAmount - fineWaivedAmount)
        : 0;

      const totalPayable = amountDue + effectiveFine;
      const amountRemaining = Math.max(
        0,
        totalPayable - amountPaid
      );

      if (amount > amountRemaining) {
        return reply.code(400).send({
          success: false,
          error: `Payment exceeds remaining balance of ${amountRemaining}`,
        });
      }

      const receiptSequence = db.prepare(
        `SELECT receipt_number
         FROM fee_payments
         WHERE receipt_number GLOB '[0-9]*'
         ORDER BY CAST(receipt_number AS INTEGER) DESC
         LIMIT 1`
      ).get() as { receipt_number?: string } | undefined;

      const lastReceiptNumber = Number(
        receiptSequence?.receipt_number ?? 0
      );

      const receiptNumber = String(
        Number.isFinite(lastReceiptNumber) && lastReceiptNumber > 0
          ? lastReceiptNumber + 1
          : 1
      ).padStart(4, '0');

      const result = db.prepare(
        `INSERT INTO fee_payments
          (
            student_fee_id,
            amount,
            payment_date,
            payment_method,
            receipt_number,
            received_by,
            notes
          )
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(
        studentFeeId,
        amount,
        paymentDate,
        paymentMethod,
        receiptNumber,
        request.user!.id,
        notes ?? null
      );

      const newAmountPaid = amountPaid + amount;
      const newStatus: StudentFeeStatus =
        newAmountPaid >= totalPayable
          ? 'paid'
          : 'partial';

      db.prepare(
        `UPDATE student_fees
         SET status = ?,
             updated_at = datetime('now')
         WHERE id = ?`
      ).run(newStatus, studentFeeId);

      const row = db.prepare(
        `SELECT fp.id,
                fp.student_fee_id,
                fp.amount,
                fp.payment_date,
                fp.payment_method,
                fp.receipt_number,
                fp.received_by,
                u.display_name AS received_by_name,
                fp.notes,
                fp.created_at
         FROM fee_payments fp
         JOIN users u ON u.id = fp.received_by
         WHERE fp.id = ?`
      ).get(result.lastInsertRowid as number) as unknown as FeePaymentRow;

      const data: FeePayment = {
        id: Number(row.id),
        studentFeeId: Number(row.student_fee_id),
        amount: Number(row.amount),
        paymentDate: row.payment_date,
        paymentMethod: row.payment_method,
        receiptNumber: row.receipt_number,
        receivedBy: Number(row.received_by),
        receivedByName: row.received_by_name,
        notes: row.notes,
        createdAt: row.created_at,
      };

      return reply.code(201).send({
        success: true,
        data,
      });
    }
  );

  // ── GET /api/fees/student-fees/:id/payments ───────────────────────────────
  fastify.post<{
    Params: { id: string };
    Body: { waivedAmount: number; reason?: string | null };
    Reply: ApiResponse<any>;
  }>(
    '/student-fees/:id/fine-waive',
    async (request, reply) => {
      const db = getDatabase();
      const studentFeeId = Number(request.params.id);
      const waivedAmount = Number(request.body.waivedAmount);
      const reason = request.body.reason?.trim() || '';

      if (!Number.isInteger(studentFeeId) || studentFeeId <= 0) {
        return reply.code(400).send({
          success: false,
          error: 'Invalid student fee id',
        });
      }

      if (!Number.isInteger(waivedAmount) || waivedAmount <= 0) {
        return reply.code(400).send({
          success: false,
          error: 'Waived amount must be greater than zero',
        });
      }

      if (!reason) {
        return reply.code(400).send({
          success: false,
          error: 'A reason is required for a fine waiver',
        });
      }

      if (reason.length > 500) {
        return reply.code(400).send({
          success: false,
          error: 'Fine waiver reason cannot exceed 500 characters',
        });
      }

      const fee = db.prepare(`
        SELECT
          sf.id,
          sf.student_id,
          sf.fee_period,
          sf.amount_due,
          sf.fine_amount,
          sf.fine_waived,
          sf.fine_waived_amount
        FROM student_fees sf
        WHERE sf.id = ?
      `).get(studentFeeId) as {
        id: number;
        student_id: number;
        fee_period: string;
        amount_due: number;
        fine_amount: number;
        fine_waived: number;
        fine_waived_amount: number;
      } | undefined;

      if (!fee) {
        return reply.code(404).send({
          success: false,
          error: 'Student fee not found',
        });
      }

      const configuredFine = Math.max(0, Number(fee.fine_amount ?? 0));

      if (configuredFine <= 0) {
        return reply.code(400).send({
          success: false,
          error: 'No fine is configured for this fee',
        });
      }

      const existingWaivedAmount = Math.min(
        configuredFine,
        Math.max(0, Number(fee.fine_waived_amount ?? 0))
      );

      const remainingWaiverable = Math.max(
        0,
        configuredFine - existingWaivedAmount
      );

      if (remainingWaiverable <= 0) {
        return reply.code(400).send({
          success: false,
          error: 'The configured fine has already been fully waived',
        });
      }

      if (waivedAmount > remainingWaiverable) {
        return reply.code(400).send({
          success: false,
          error: `Waived amount cannot exceed remaining waiverable fine of ${remainingWaiverable}`,
        });
      }

      const newTotalWaivedAmount =
        existingWaivedAmount + waivedAmount;

      const fullyWaived =
        newTotalWaivedAmount >= configuredFine;

      const user = (request as any).user;
      const userId = Number(user?.id ?? user?.userId ?? 0);

      if (!userId) {
        return reply.code(401).send({
          success: false,
          error: 'Authenticated user not found',
        });
      }

      db.prepare(`
        UPDATE student_fees
        SET
          fine_waived = ?,
          fine_waived_amount = ?,
          fine_waived_at = datetime('now'),
          fine_waived_by = ?,
          fine_waived_reason = ?,
          updated_at = datetime('now')
        WHERE id = ?
      `).run(
        fullyWaived ? 1 : 0,
        newTotalWaivedAmount,
        userId,
        reason,
        studentFeeId
      );

      const updated = db.prepare(`
        SELECT
          sf.id,
          sf.student_id,
          sf.fee_period,
          sf.amount_due,
          sf.fine_amount,
          sf.fine_waived,
          sf.fine_waived_amount,
          sf.fine_waived_at,
          sf.fine_waived_by,
          sf.fine_waived_reason,
          COALESCE((
            SELECT SUM(fp.amount)
            FROM fee_payments fp
            WHERE fp.student_fee_id = sf.id
          ), 0) AS paid_amount
        FROM student_fees sf
        WHERE sf.id = ?
      `).get(studentFeeId) as {
        id: number;
        student_id: number;
        fee_period: string;
        amount_due: number;
        fine_amount: number;
        fine_waived: number;
        fine_waived_amount: number;
        fine_waived_at: string | null;
        fine_waived_by: number | null;
        fine_waived_reason: string | null;
        paid_amount: number;
      };

      const effectiveFine = Math.max(
        0,
        Number(updated.fine_amount) - Number(updated.fine_waived_amount)
      );

      const totalPayable =
        Number(updated.amount_due) + effectiveFine;

      const remainingAmount = Math.max(
        0,
        totalPayable - Number(updated.paid_amount)
      );

      return reply.send({
        success: true,
        data: {
          id: updated.id,
          studentId: updated.student_id,
          feePeriod: updated.fee_period,
          amountDue: Number(updated.amount_due),
          fineAmount: Number(updated.fine_amount),
          fineWaived: Boolean(updated.fine_waived),
          fineWaivedAmount: Number(updated.fine_waived_amount),
          fineWaivedAt: updated.fine_waived_at,
          fineWaivedBy: updated.fine_waived_by,
          fineWaivedReason: updated.fine_waived_reason,
          paidAmount: Number(updated.paid_amount),
          remainingAmount,
        },
      });
    }
  );

  fastify.get<{
    Params: { id: string };
    Reply: ApiResponse<FeePayment[]>;
  }>(
    '/student-fees/:id/payments',
    async (request, reply) => {
      const studentFeeId = Number(request.params.id);

      if (!Number.isInteger(studentFeeId) || studentFeeId < 1) {
        return reply.code(400).send({
          success: false,
          error: 'Invalid student fee id',
        });
      }

      const db = getDatabase();

      const studentFee = db.prepare(
        'SELECT id FROM student_fees WHERE id = ?'
      ).get(studentFeeId);

      if (!studentFee) {
        return reply.code(404).send({
          success: false,
          error: 'Student fee not found',
        });
      }

      const rows = db.prepare(
        `SELECT fp.id,
                fp.student_fee_id,
                fp.amount,
                fp.payment_date,
                fp.payment_method,
                fp.receipt_number,
                fp.received_by,
                u.display_name AS received_by_name,
                fp.notes,
                fp.created_at
         FROM fee_payments fp
         JOIN users u ON u.id = fp.received_by
         WHERE fp.student_fee_id = ?
         ORDER BY fp.payment_date DESC, fp.id DESC`
      ).all(studentFeeId) as unknown as FeePaymentRow[];

      return reply.send({
        success: true,
        data: rows.map((row): FeePayment => ({
          id: Number(row.id),
          studentFeeId: Number(row.student_fee_id),
          amount: Number(row.amount),
          paymentDate: row.payment_date,
          paymentMethod: row.payment_method,
          receiptNumber: row.receipt_number,
          receivedBy: Number(row.received_by),
          receivedByName: row.received_by_name,
          notes: row.notes,
          createdAt: row.created_at,
        })),
      });
    }
  );
}