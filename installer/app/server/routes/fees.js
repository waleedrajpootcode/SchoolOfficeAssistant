/**
 * Fees routes
 *
 * Admin only:
 *   GET  /api/fees/structures     — list fee structures
 *   POST /api/fees/structures     — create a fee structure
 *   GET  /api/fees/student-fees   — list student fees
 *   POST /api/fees/student-fees   — create a student fee
 */
import { getDatabase } from '../db/database.js';
import { requireAdmin } from '../hooks/authenticate.js';
function toFeeStructure(row) {
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
function toStudentFee(row) {
    const amountDue = Number(row.amount_due);
    const amountPaid = Number(row.amount_paid);
    const amountRemaining = Math.max(0, amountDue - amountPaid);
    let status = 'unpaid';
    if (amountPaid >= amountDue) {
        status = 'paid';
    }
    else if (amountPaid > 0) {
        status = 'partial';
    }
    return {
        id: Number(row.id),
        studentId: Number(row.student_id),
        studentName: row.student_name,
        rollNumber: row.roll_number,
        feeStructureId: row.fee_structure_id === null
            ? null
            : Number(row.fee_structure_id),
        feePeriod: row.fee_period,
        amountDue,
        amountPaid,
        amountRemaining,
        status,
        notes: row.notes,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}
export async function feeRoutes(fastify) {
    fastify.addHook('preHandler', requireAdmin);
    // ── GET /api/fees/structures ──────────────────────────────────────────────
    fastify.get('/structures', async (_request, reply) => {
        const db = getDatabase();
        const rows = db.prepare(`SELECT fs.id,
                fs.class_id,
                c.name AS class_name,
                fs.fee_name,
                fs.amount,
                fs.is_active,
                fs.created_at,
                fs.updated_at
         FROM fee_structures fs
         JOIN classes c ON c.id = fs.class_id
         ORDER BY c.name, fs.fee_name`).all();
        return reply.send({
            success: true,
            data: rows.map(toFeeStructure),
        });
    });
    // ── POST /api/fees/structures ─────────────────────────────────────────────
    fastify.post('/structures', {
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
    }, async (request, reply) => {
        const { classId, feeName, amount } = request.body;
        const db = getDatabase();
        // Class must exist and be active.
        const cls = db.prepare('SELECT id FROM classes WHERE id = ? AND is_active = 1').get(classId);
        if (!cls) {
            return reply.code(400).send({
                success: false,
                error: 'Class not found or inactive',
            });
        }
        // One fee name can exist only once per class.
        const duplicate = db.prepare('SELECT id FROM fee_structures WHERE class_id = ? AND fee_name = ?').get(classId, feeName);
        if (duplicate) {
            return reply.code(409).send({
                success: false,
                error: 'Fee structure already exists for this class',
            });
        }
        const result = db.prepare(`INSERT INTO fee_structures (class_id, fee_name, amount)
         VALUES (?, ?, ?)`).run(classId, feeName, amount);
        const newRow = db.prepare(`SELECT fs.id,
                fs.class_id,
                c.name AS class_name,
                fs.fee_name,
                fs.amount,
                fs.is_active,
                fs.created_at,
                fs.updated_at
         FROM fee_structures fs
         JOIN classes c ON c.id = fs.class_id
         WHERE fs.id = ?`).get(result.lastInsertRowid);
        return reply.code(201).send({
            success: true,
            data: toFeeStructure(newRow),
        });
    });
    // ── GET /api/fees/summary ─────────────────────────────────────────────────
    fastify.get('/summary', async (_request, reply) => {
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
          ), 0) AS paid_count
        FROM student_fees sf
      `).get();
        const summary = {
            totalDue: Number(row.total_due),
            totalPaid: Number(row.total_paid),
            totalRemaining: Number(row.total_due) - Number(row.total_paid),
            unpaidCount: Number(row.unpaid_count),
            partialCount: Number(row.partial_count),
            paidCount: Number(row.paid_count),
        };
        return reply.send({
            success: true,
            data: summary,
        });
    });
    // ── GET /api/fees/student-fees ────────────────────────────────────────────
    fastify.get('/student-fees', async (_request, reply) => {
        const db = getDatabase();
        const rows = db.prepare(`SELECT sf.id,
                sf.student_id,
                s.full_name AS student_name,
                s.roll_number,
                sf.fee_structure_id,
                sf.fee_period,
                sf.amount_due,
                COALESCE(SUM(fp.amount), 0) AS amount_paid,
                sf.notes,
                sf.created_at,
                sf.updated_at
         FROM student_fees sf
         JOIN students s ON s.id = sf.student_id
         LEFT JOIN fee_payments fp ON fp.student_fee_id = sf.id
         GROUP BY sf.id
         ORDER BY sf.fee_period DESC, s.roll_number`).all();
        return reply.send({
            success: true,
            data: rows.map(toStudentFee),
        });
    });
    // ── POST /api/fees/student-fees ───────────────────────────────────────────
    fastify.post('/student-fees', {
        schema: {
            body: {
                type: 'object',
                required: ['studentId', 'feePeriod', 'amountDue'],
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
                    amountDue: {
                        type: 'integer',
                        minimum: 0,
                    },
                    notes: {
                        type: 'string',
                        maxLength: 500,
                    },
                },
            },
        },
    }, async (request, reply) => {
        const { studentId, feeStructureId, feePeriod, amountDue, notes, } = request.body;
        const db = getDatabase();
        const student = db.prepare('SELECT id FROM students WHERE id = ? AND is_active = 1').get(studentId);
        if (!student) {
            return reply.code(400).send({
                success: false,
                error: 'Student not found or inactive',
            });
        }
        if (feeStructureId !== undefined) {
            const structure = db.prepare(`SELECT id
           FROM fee_structures
           WHERE id = ? AND is_active = 1`).get(feeStructureId);
            if (!structure) {
                return reply.code(400).send({
                    success: false,
                    error: 'Fee structure not found or inactive',
                });
            }
        }
        const duplicate = db.prepare('SELECT id FROM student_fees WHERE student_id = ? AND fee_period = ?').get(studentId, feePeriod);
        if (duplicate) {
            return reply.code(409).send({
                success: false,
                error: 'Student fee already exists for this period',
            });
        }
        const result = db.prepare(`INSERT INTO student_fees
          (student_id, fee_structure_id, fee_period, amount_due, notes)
         VALUES (?, ?, ?, ?, ?)`).run(studentId, feeStructureId ?? null, feePeriod, amountDue, notes ?? null);
        const row = db.prepare(`SELECT sf.id,
                sf.student_id,
                s.full_name AS student_name,
                s.roll_number,
                sf.fee_structure_id,
                sf.fee_period,
                sf.amount_due,
                sf.notes,
                sf.created_at,
                sf.updated_at
         FROM student_fees sf
         JOIN students s ON s.id = sf.student_id
         WHERE sf.id = ?`).get(result.lastInsertRowid);
        const data = {
            id: Number(row.id),
            studentId: Number(row.student_id),
            studentName: row.student_name,
            rollNumber: row.roll_number,
            feeStructureId: row.fee_structure_id === null
                ? null
                : Number(row.fee_structure_id),
            feePeriod: row.fee_period,
            amountDue: Number(row.amount_due),
            amountPaid: 0,
            amountRemaining: Number(row.amount_due),
            status: 'unpaid',
            notes: row.notes,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        };
        return reply.code(201).send({
            success: true,
            data,
        });
    });
    // ── POST /api/fees/payments ────────────────────────────────────────────────
    fastify.post('/payments', {
        schema: {
            body: {
                type: 'object',
                required: [
                    'studentFeeId',
                    'amount',
                    'paymentDate',
                    'paymentMethod',
                    'receiptNumber',
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
                    receiptNumber: {
                        type: 'string',
                        minLength: 1,
                        maxLength: 100,
                    },
                    notes: {
                        type: 'string',
                        maxLength: 500,
                    },
                },
            },
        },
    }, async (request, reply) => {
        const { studentFeeId, amount, paymentDate, paymentMethod, receiptNumber, notes, } = request.body;
        const db = getDatabase();
        const studentFee = db.prepare(`SELECT id, amount_due
         FROM student_fees
         WHERE id = ?`).get(studentFeeId);
        if (!studentFee) {
            return reply.code(404).send({
                success: false,
                error: 'Student fee not found',
            });
        }
        const paymentTotal = db.prepare(`SELECT COALESCE(SUM(amount), 0) AS amount_paid
         FROM fee_payments
         WHERE student_fee_id = ?`).get(studentFeeId);
        const amountPaid = Number(paymentTotal.amount_paid);
        const amountRemaining = Number(studentFee.amount_due) - amountPaid;
        if (amount > amountRemaining) {
            return reply.code(400).send({
                success: false,
                error: `Payment exceeds remaining balance of ${amountRemaining}`,
            });
        }
        const duplicateReceipt = db.prepare(`SELECT id
         FROM fee_payments
         WHERE receipt_number = ?`).get(receiptNumber);
        if (duplicateReceipt) {
            return reply.code(409).send({
                success: false,
                error: 'Receipt number already exists',
            });
        }
        const result = db.prepare(`INSERT INTO fee_payments
          (
            student_fee_id,
            amount,
            payment_date,
            payment_method,
            receipt_number,
            received_by,
            notes
          )
         VALUES (?, ?, ?, ?, ?, ?, ?)`).run(studentFeeId, amount, paymentDate, paymentMethod, receiptNumber, request.user.id, notes ?? null);
        const newAmountPaid = amountPaid + amount;
        const newStatus = newAmountPaid >= Number(studentFee.amount_due)
            ? 'paid'
            : 'partial';
        db.prepare(`UPDATE student_fees
         SET status = ?,
             updated_at = datetime('now')
         WHERE id = ?`).run(newStatus, studentFeeId);
        const row = db.prepare(`SELECT fp.id,
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
         WHERE fp.id = ?`).get(result.lastInsertRowid);
        const data = {
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
    });
    // ── GET /api/fees/student-fees/:id/payments ───────────────────────────────
    fastify.get('/student-fees/:id/payments', async (request, reply) => {
        const studentFeeId = Number(request.params.id);
        if (!Number.isInteger(studentFeeId) || studentFeeId < 1) {
            return reply.code(400).send({
                success: false,
                error: 'Invalid student fee id',
            });
        }
        const db = getDatabase();
        const studentFee = db.prepare('SELECT id FROM student_fees WHERE id = ?').get(studentFeeId);
        if (!studentFee) {
            return reply.code(404).send({
                success: false,
                error: 'Student fee not found',
            });
        }
        const rows = db.prepare(`SELECT fp.id,
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
         ORDER BY fp.payment_date DESC, fp.id DESC`).all(studentFeeId);
        return reply.send({
            success: true,
            data: rows.map((row) => ({
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
    });
}
//# sourceMappingURL=fees.js.map