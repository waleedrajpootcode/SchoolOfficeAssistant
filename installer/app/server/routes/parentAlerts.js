import { getDatabase } from '../db/database.js';
import { requireAdmin } from '../hooks/authenticate.js';
export async function parentAlertsRoutes(fastify) {
    fastify.addHook('preHandler', requireAdmin);
    fastify.get('/', async (_request, reply) => {
        const db = getDatabase();
        const alerts = [];
        const feeRows = db.prepare(`
      SELECT
        sf.id AS fee_id,
        sf.student_id,
        s.full_name AS student_name,
        s.roll_number,
        s.guardian_name,
        s.guardian_phone,
        c.name AS class_name,
        sf.fee_period,
        sf.amount_due,
        sf.due_date,
        sf.fine_start_date,
        sf.fine_amount,
        COALESCE((
          SELECT SUM(fp.amount)
          FROM fee_payments fp
          WHERE fp.student_fee_id = sf.id
        ), 0) AS amount_paid
      FROM student_fees sf
      JOIN students s ON s.id = sf.student_id
      JOIN classes c ON c.id = s.class_id
      WHERE s.is_active = 1
        AND sf.due_date IS NOT NULL
        AND sf.due_date < date('now')
      ORDER BY sf.due_date ASC, s.roll_number ASC
    `).all();
        for (const row of feeRows) {
            const principalRemaining = Math.max(0, Number(row.amount_due) - Number(row.amount_paid));
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            let appliedFine = 0;
            const fineAmount = Math.max(0, Number(row.fine_amount ?? 0));
            if (principalRemaining > 0 &&
                fineAmount > 0 &&
                row.fine_start_date) {
                const fineStartDate = new Date(`${row.fine_start_date}T00:00:00`);
                if (today >= fineStartDate) {
                    appliedFine = fineAmount;
                }
            }
            const totalPayable = Number(row.amount_due) + appliedFine;
            const totalRemaining = Math.max(0, totalPayable - Number(row.amount_paid));
            // Skip fees that have no actionable balance.
            if (totalRemaining <= 0) {
                continue;
            }
            const due = new Date(`${row.due_date}T00:00:00`);
            const daysOverdue = Math.max(1, Math.floor((today.getTime() - due.getTime()) / 86400000));
            const guardian = row.guardian_name?.trim() || 'Parent/Guardian';
            const fineText = appliedFine > 0
                ? ` A late fee of Rs. ${appliedFine.toLocaleString('en-PK')} ` +
                    `has been applied. Total payable is Rs. ` +
                    `${totalPayable.toLocaleString('en-PK')}.`
                : ` The late fee is currently Rs. 0.`;
            const message = `Dear ${guardian}, this is a reminder that ${row.student_name}'s ` +
                `school fee for ${row.fee_period} was due on ${row.due_date}. ` +
                `The outstanding fee balance is Rs. ` +
                `${principalRemaining.toLocaleString('en-PK')}.` +
                fineText +
                ` Total remaining payable is Rs. ` +
                `${totalRemaining.toLocaleString('en-PK')}. ` +
                `Please contact the school office for further information. Thank you.`;
            alerts.push({
                id: `fee-${row.fee_id}`,
                type: 'fee',
                studentId: Number(row.student_id),
                studentName: row.student_name,
                rollNumber: row.roll_number,
                guardianName: guardian,
                guardianPhone: row.guardian_phone?.trim() || '',
                className: row.class_name,
                message,
                feePeriod: row.fee_period,
                amountRemaining: principalRemaining,
                dueDate: row.due_date,
                fineStartDate: row.fine_start_date,
                fineAmount,
                appliedFine,
                totalPayable,
                totalRemaining,
                daysOverdue,
                attendanceDate: null,
            });
        }
        const absenceRows = db.prepare(`
      SELECT
        a.id AS attendance_id,
        a.student_id,
        s.full_name AS student_name,
        s.roll_number,
        s.guardian_name,
        s.guardian_phone,
        c.name AS class_name,
        a.attendance_date
      FROM attendance a
      JOIN students s ON s.id = a.student_id
      JOIN classes c ON c.id = s.class_id
      WHERE s.is_active = 1
        AND a.attendance_date = date('now')
        AND a.status = 'absent'
      ORDER BY s.roll_number ASC
    `).all();
        for (const row of absenceRows) {
            const guardian = row.guardian_name?.trim() || 'Parent/Guardian';
            const message = `Dear ${guardian}, ${row.student_name} was marked absent from ` +
                `school today (${row.attendance_date}). Please contact the school ` +
                `office if this absence was unexpected. Thank you.`;
            alerts.push({
                id: `absence-${row.attendance_id}`,
                type: 'absence',
                studentId: Number(row.student_id),
                studentName: row.student_name,
                rollNumber: row.roll_number,
                guardianName: guardian,
                guardianPhone: row.guardian_phone?.trim() || '',
                className: row.class_name,
                message,
                feePeriod: null,
                amountRemaining: null,
                dueDate: null,
                fineStartDate: null,
                fineAmount: null,
                appliedFine: null,
                totalPayable: null,
                totalRemaining: null,
                daysOverdue: null,
                attendanceDate: row.attendance_date,
            });
        }
        return reply.send({
            success: true,
            data: alerts,
        });
    });
}
//# sourceMappingURL=parentAlerts.js.map