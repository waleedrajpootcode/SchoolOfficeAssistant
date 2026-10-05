import { getDatabase } from '../db/database.js';
import { requireAdmin } from '../hooks/authenticate.js';
export async function familyPaymentRoutes(fastify) {
    fastify.addHook('preHandler', requireAdmin);
    // GET /api/family-payments/family/:familyId/outstanding
    fastify.get('/family/:familyId/outstanding', async (request, reply) => {
        const familyId = Number(request.params.familyId);
        if (!Number.isInteger(familyId) || familyId <= 0) {
            return reply.code(400).send({
                success: false,
                error: 'Invalid family id',
            });
        }
        const db = getDatabase();
        const family = db.prepare('SELECT id, is_active FROM families WHERE id = ?').get(familyId);
        if (!family) {
            return reply.code(404).send({
                success: false,
                error: 'Family not found',
            });
        }
        if (!family.is_active) {
            return reply.code(400).send({
                success: false,
                error: 'Family is inactive',
            });
        }
        const rows = db.prepare(`
        SELECT
          sf.id AS student_fee_id,
          sf.student_id,
          s.full_name AS student_name,
          s.roll_number,
          c.name AS class_name,
          sf.fee_period,
          sf.amount_due,
          COALESCE(SUM(fp.amount), 0) AS amount_paid,
          sf.fine_amount,
          sf.fine_waived_amount,
          sf.due_date
        FROM student_fees sf
        JOIN students s
          ON s.id = sf.student_id
        JOIN classes c
          ON c.id = s.class_id
        LEFT JOIN fee_payments fp
          ON fp.student_fee_id = sf.id
        WHERE s.family_id = ?
          AND s.is_active = 1
          AND sf.fee_period <= strftime('%Y-%m', 'now', 'localtime')
        GROUP BY sf.id
        ORDER BY s.roll_number, sf.fee_period ASC
      `).all(familyId);
        const childrenMap = new Map();
        let totalOutstanding = 0;
        for (const row of rows) {
            const amountDue = Math.max(0, Number(row.amount_due));
            const amountPaid = Math.max(0, Number(row.amount_paid));
            const fineAmount = Math.max(0, Number(row.fine_amount));
            const fineWaivedAmount = Math.min(fineAmount, Math.max(0, Number(row.fine_waived_amount)));
            const effectiveFine = Math.max(0, fineAmount - fineWaivedAmount);
            const totalPayable = amountDue + effectiveFine;
            const remaining = Math.max(0, totalPayable - amountPaid);
            if (remaining <= 0) {
                continue;
            }
            let child = childrenMap.get(Number(row.student_id));
            if (!child) {
                child = {
                    studentId: Number(row.student_id),
                    studentName: row.student_name,
                    rollNumber: row.roll_number,
                    className: row.class_name,
                    fees: [],
                    totalOutstanding: 0,
                };
                childrenMap.set(Number(row.student_id), child);
            }
            child.fees.push({
                studentFeeId: Number(row.student_fee_id),
                feePeriod: row.fee_period,
                amountDue,
                amountPaid,
                fineAmount,
                fineWaivedAmount,
                effectiveFine,
                totalPayable,
                remaining,
                dueDate: row.due_date ?? null,
            });
            child.totalOutstanding += remaining;
            totalOutstanding += remaining;
        }
        return reply.send({
            success: true,
            data: {
                familyId,
                children: Array.from(childrenMap.values()),
                totalOutstanding,
            },
        });
    });
    // POST /api/family-payments
    fastify.post('/', {
        schema: {
            body: {
                type: 'object',
                required: [
                    'familyId',
                    'paymentDate',
                    'paymentMethod',
                    'items',
                ],
                properties: {
                    familyId: {
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
                    items: {
                        type: 'array',
                        minItems: 1,
                        items: {
                            type: 'object',
                            required: ['studentFeeId', 'amount'],
                            properties: {
                                studentFeeId: {
                                    type: 'integer',
                                    minimum: 1,
                                },
                                amount: {
                                    type: 'integer',
                                    minimum: 1,
                                },
                            },
                        },
                    },
                    notes: {
                        type: 'string',
                        maxLength: 500,
                    },
                },
            },
        },
    }, async (request, reply) => {
        const db = getDatabase();
        const { familyId, paymentDate, paymentMethod, items, notes, } = request.body;
        if (!Number.isInteger(familyId) || familyId <= 0) {
            return reply.code(400).send({
                success: false,
                error: 'Invalid family id',
            });
        }
        const uniqueFeeIds = new Set(items.map((item) => Number(item.studentFeeId)));
        if (uniqueFeeIds.size !== items.length ||
            items.some((item) => !Number.isInteger(item.studentFeeId) ||
                item.studentFeeId <= 0 ||
                !Number.isInteger(item.amount) ||
                item.amount <= 0)) {
            return reply.code(400).send({
                success: false,
                error: 'Invalid family payment items',
            });
        }
        const family = db.prepare(`
      SELECT id, is_active
      FROM families
      WHERE id = ?
    `).get(familyId);
        if (!family) {
            return reply.code(404).send({
                success: false,
                error: 'Family not found',
            });
        }
        if (family.is_active !== 1) {
            return reply.code(400).send({
                success: false,
                error: 'Family is inactive',
            });
        }
        const placeholders = items.map(() => '?').join(', ');
        const feeRows = db.prepare(`
      SELECT
        sf.id,
        sf.student_id,
        sf.amount_due,
        sf.fine_amount,
        sf.fine_waived,
        sf.fine_waived_amount,
        s.family_id,
        s.full_name
      FROM student_fees sf
      JOIN students s ON s.id = sf.student_id
      WHERE sf.id IN (${placeholders})
    `).all(...items.map((item) => item.studentFeeId));
        if (feeRows.length !== items.length) {
            return reply.code(400).send({
                success: false,
                error: 'One or more student fees were not found',
            });
        }
        const feeMap = new Map(feeRows.map((row) => [Number(row.id), row]));
        const payments = [];
        let totalAmount = 0;
        for (const item of items) {
            const fee = feeMap.get(item.studentFeeId);
            if (!fee || Number(fee.family_id) !== familyId) {
                return reply.code(400).send({
                    success: false,
                    error: `Student fee ${item.studentFeeId} does not belong to this family`,
                });
            }
            const paidRow = db.prepare(`
        SELECT COALESCE(SUM(amount), 0) AS amount_paid
        FROM fee_payments
        WHERE student_fee_id = ?
      `).get(item.studentFeeId);
            const amountPaid = Number(paidRow.amount_paid ?? 0);
            const effectiveFine = Math.max(0, Number(fee.fine_amount ?? 0) -
                (fee.fine_waived
                    ? Number(fee.fine_waived_amount ?? 0)
                    : 0));
            const totalPayable = Number(fee.amount_due) + effectiveFine;
            const remaining = Math.max(0, totalPayable - amountPaid);
            if (item.amount > remaining) {
                return reply.code(400).send({
                    success: false,
                    error: `Payment exceeds remaining balance for ${fee.full_name}. Remaining balance is ${remaining}`,
                });
            }
            totalAmount += item.amount;
            payments.push({
                studentFeeId: Number(fee.id),
                studentId: Number(fee.student_id),
                studentName: fee.full_name,
                amount: item.amount,
            });
        }
        if (totalAmount <= 0) {
            return reply.code(400).send({
                success: false,
                error: 'Family payment amount must be greater than zero',
            });
        }
        const receiptSequence = db.prepare(`
      SELECT receipt_number
      FROM fee_payments
      WHERE receipt_number GLOB '[0-9]*'
      ORDER BY CAST(receipt_number AS INTEGER) DESC
      LIMIT 1
    `).get();
        const batchSequence = db.prepare(`
      SELECT receipt_number
      FROM family_payment_batches
      ORDER BY CAST(receipt_number AS INTEGER) DESC
      LIMIT 1
    `).get();
        const lastIndividualReceipt = Number(receiptSequence?.receipt_number ?? 0);
        const lastFamilyReceipt = Number(batchSequence?.receipt_number ?? 0);
        const nextReceipt = Math.max(Number.isFinite(lastIndividualReceipt)
            ? lastIndividualReceipt
            : 0, Number.isFinite(lastFamilyReceipt)
            ? lastFamilyReceipt
            : 0) + 1;
        const receiptNumber = String(nextReceipt).padStart(4, '0');
        db.exec('BEGIN');
        try {
            const batchResult = db.prepare(`
        INSERT INTO family_payment_batches
          (
            family_id,
            receipt_number,
            payment_date,
            payment_method,
            total_amount,
            received_by,
            notes
          )
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(familyId, receiptNumber, paymentDate, paymentMethod, totalAmount, request.user.id, notes ?? null);
            const batchId = Number(batchResult.lastInsertRowid);
            const paymentRows = [];
            for (const payment of payments) {
                const result = db.prepare(`
          INSERT INTO fee_payments
            (
              student_fee_id,
              amount,
              payment_date,
              payment_method,
              receipt_number,
              received_by,
              notes,
              family_payment_batch_id
            )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(payment.studentFeeId, payment.amount, paymentDate, paymentMethod, `${receiptNumber}-${payment.studentFeeId}`, request.user.id, notes ?? null, batchId);
                const paidRow = db.prepare(`
          SELECT COALESCE(SUM(amount), 0) AS amount_paid
          FROM fee_payments
          WHERE student_fee_id = ?
        `).get(payment.studentFeeId);
                const fee = feeMap.get(payment.studentFeeId);
                const effectiveFine = Math.max(0, Number(fee.fine_amount ?? 0) -
                    (fee.fine_waived
                        ? Number(fee.fine_waived_amount ?? 0)
                        : 0));
                const totalPayable = Number(fee.amount_due) + effectiveFine;
                const newStatus = Number(paidRow.amount_paid) >= totalPayable
                    ? 'paid'
                    : 'partial';
                db.prepare(`
          UPDATE student_fees
          SET status = ?,
              updated_at = datetime('now')
          WHERE id = ?
        `).run(newStatus, payment.studentFeeId);
                paymentRows.push({
                    paymentId: Number(result.lastInsertRowid),
                    studentFeeId: payment.studentFeeId,
                    studentId: payment.studentId,
                    studentName: payment.studentName,
                    amount: payment.amount,
                });
            }
            db.exec('COMMIT');
            return reply.code(201).send({
                success: true,
                data: {
                    batchId,
                    familyId,
                    receiptNumber,
                    totalAmount,
                    paymentDate,
                    paymentMethod,
                    payments: paymentRows,
                },
            });
        }
        catch (error) {
            try {
                db.exec('ROLLBACK');
            }
            catch {
                // Preserve original error.
            }
            throw error;
        }
    });
    // GET /api/family-payments/:batchId
    // Returns the complete saved family receipt for printing/reprinting.
    fastify.get('/:batchId', async (request, reply) => {
        const batchId = Number(request.params.batchId);
        if (!Number.isInteger(batchId) || batchId < 1) {
            return reply.code(400).send({
                success: false,
                error: 'Invalid family payment batch id',
            });
        }
        const db = getDatabase();
        const batch = db.prepare(`
      SELECT
        fpb.id,
        fpb.family_id,
        fpb.receipt_number,
        fpb.payment_date,
        fpb.payment_method,
        fpb.total_amount,
        fpb.received_by,
        fpb.notes,
        f.guardian_name,
        f.guardian_phone,
        f.address,
        u.display_name AS received_by_name
      FROM family_payment_batches fpb
      JOIN families f ON f.id = fpb.family_id
      JOIN users u ON u.id = fpb.received_by
      WHERE fpb.id = ?
    `).get(batchId);
        if (!batch) {
            return reply.code(404).send({
                success: false,
                error: 'Family payment receipt not found',
            });
        }
        const children = db.prepare(`
      SELECT
        fp.id AS payment_id,
        fp.student_fee_id,
        s.id AS student_id,
        s.full_name AS student_name,
        s.roll_number,
        c.name AS class_name,
        sf.fee_period,
        sf.amount_due,
        sf.fine_amount,
        sf.fine_waived,
        sf.fine_waived_amount,
        fp.amount AS payment_amount,
        COALESCE((
          SELECT SUM(fp_all.amount)
          FROM fee_payments fp_all
          WHERE fp_all.student_fee_id = sf.id
        ), 0) AS paid_amount
      FROM fee_payments fp
      JOIN student_fees sf ON sf.id = fp.student_fee_id
      JOIN students s ON s.id = sf.student_id
      JOIN classes c ON c.id = s.class_id
      WHERE fp.family_payment_batch_id = ?
        AND s.family_id = ?
      ORDER BY s.roll_number, s.full_name, sf.fee_period, fp.id
    `).all(batchId, Number(batch.family_id));
        return reply.send({
            success: true,
            data: {
                batchId: Number(batch.id),
                familyId: Number(batch.family_id),
                receiptNumber: batch.receipt_number,
                paymentDate: batch.payment_date,
                paymentMethod: batch.payment_method,
                totalAmount: Number(batch.total_amount),
                receivedBy: Number(batch.received_by),
                receivedByName: batch.received_by_name,
                notes: batch.notes,
                family: {
                    guardianName: batch.guardian_name,
                    guardianPhone: batch.guardian_phone,
                    address: batch.address,
                },
                children: children.map((child) => {
                    const fineAmount = Math.max(0, Number(child.fine_amount ?? 0));
                    const fineWaivedAmount = child.fine_waived
                        ? Math.min(fineAmount, Math.max(0, Number(child.fine_waived_amount ?? 0)))
                        : 0;
                    const effectiveFine = Math.max(0, fineAmount - fineWaivedAmount);
                    const totalPayable = Number(child.amount_due) + effectiveFine;
                    const paidAmount = Number(child.paid_amount ?? 0);
                    return {
                        paymentId: Number(child.payment_id),
                        studentFeeId: Number(child.student_fee_id),
                        studentId: Number(child.student_id),
                        studentName: child.student_name,
                        rollNumber: child.roll_number,
                        className: child.class_name,
                        feePeriod: child.fee_period,
                        amountDue: Number(child.amount_due),
                        fineAmount,
                        fineWaivedAmount,
                        paidAmount,
                        remaining: Math.max(0, totalPayable - paidAmount),
                        paymentAmount: Number(child.payment_amount),
                    };
                }),
            },
        });
    });
}
//# sourceMappingURL=familyPayments.js.map