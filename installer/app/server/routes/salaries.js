import { getDatabase } from '../db/database.js';
import { requireAdmin } from '../hooks/authenticate.js';
function toSalary(row) {
    const salaryDue = Number(row.salary_due);
    const salaryPaid = Number(row.salary_paid);
    const salaryRemaining = Math.max(0, salaryDue - salaryPaid);
    let status = 'pending';
    if (salaryPaid >= salaryDue) {
        status = 'paid';
    }
    else if (salaryPaid > 0) {
        status = 'partial';
    }
    return {
        id: Number(row.id),
        teacherId: Number(row.teacher_id),
        teacherName: row.teacher_name,
        username: row.username,
        salaryPeriod: row.salary_period,
        salaryDue,
        salaryPaid,
        salaryRemaining,
        status,
        paymentDate: row.payment_date,
        paymentMethod: row.payment_method,
        notes: row.notes,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}
const SALARY_SELECT = `
  SELECT
    ts.id,
    ts.teacher_id,
    u.display_name AS teacher_name,
    u.username,
    ts.salary_period,
    ts.salary_due,
    ts.salary_paid,
    ts.payment_date,
    ts.payment_method,
    ts.notes,
    ts.created_at,
    ts.updated_at
  FROM teacher_salaries ts
  JOIN users u ON u.id = ts.teacher_id
  JOIN roles r ON r.id = u.role_id
  WHERE r.name = 'teacher'
`;
export async function salaryRoutes(fastify) {
    fastify.addHook('preHandler', requireAdmin);
    // GET /api/salaries
    fastify.get('/', async (request, reply) => {
        const db = getDatabase();
        let sql = `${SALARY_SELECT}`;
        const params = [];
        const teacherId = request.query.teacherId
            ? Number(request.query.teacherId)
            : undefined;
        if (teacherId !== undefined) {
            if (!Number.isInteger(teacherId) || teacherId < 1) {
                return reply.code(400).send({
                    success: false,
                    error: 'Invalid teacher id',
                });
            }
            sql += ' AND ts.teacher_id = ?';
            params.push(teacherId);
        }
        if (request.query.period !== undefined) {
            if (!/^\d{4}-\d{2}$/.test(request.query.period)) {
                return reply.code(400).send({
                    success: false,
                    error: 'Invalid salary period',
                });
            }
            sql += ' AND ts.salary_period = ?';
            params.push(request.query.period);
        }
        sql += ' ORDER BY ts.salary_period DESC, u.display_name';
        const rows = db.prepare(sql).all(...params);
        return reply.send({
            success: true,
            data: rows.map(toSalary),
        });
    });
    // POST /api/salaries
    fastify.post('/', {
        schema: {
            body: {
                type: 'object',
                required: ['teacherId', 'salaryPeriod', 'salaryDue'],
                properties: {
                    teacherId: { type: 'integer', minimum: 1 },
                    salaryPeriod: {
                        type: 'string',
                        pattern: '^\\d{4}-\\d{2}$',
                    },
                    salaryDue: { type: 'integer', minimum: 0 },
                    notes: { type: 'string', maxLength: 500 },
                },
            },
        },
    }, async (request, reply) => {
        const { teacherId, salaryPeriod, salaryDue, notes } = request.body;
        const db = getDatabase();
        const teacher = db.prepare(`
      SELECT u.id
      FROM users u
      JOIN roles r ON r.id = u.role_id
      WHERE u.id = ? AND r.name = 'teacher' AND u.is_active = 1
    `).get(teacherId);
        if (!teacher) {
            return reply.code(400).send({
                success: false,
                error: 'Active teacher not found',
            });
        }
        const existing = db.prepare(`
      SELECT id
      FROM teacher_salaries
      WHERE teacher_id = ? AND salary_period = ?
    `).get(teacherId, salaryPeriod);
        if (existing) {
            return reply.code(409).send({
                success: false,
                error: 'Salary record already exists for this teacher and period',
            });
        }
        const result = db.prepare(`
      INSERT INTO teacher_salaries
        (teacher_id, salary_period, salary_due, notes)
      VALUES (?, ?, ?, ?)
    `).run(teacherId, salaryPeriod, salaryDue, notes?.trim() || null);
        const row = db.prepare(`${SALARY_SELECT} AND ts.id = ?`).get(result.lastInsertRowid);
        return reply.code(201).send({
            success: true,
            data: toSalary(row),
        });
    });
    // PATCH /api/salaries/:id
    fastify.patch('/:id', {
        schema: {
            body: {
                type: 'object',
                properties: {
                    salaryPaid: { type: 'integer', minimum: 0 },
                    paymentDate: {
                        anyOf: [
                            { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
                            { type: 'null' },
                        ],
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
            },
        },
    }, async (request, reply) => {
        const id = Number(request.params.id);
        if (!Number.isInteger(id) || id < 1) {
            return reply.code(400).send({
                success: false,
                error: 'Invalid salary id',
            });
        }
        const db = getDatabase();
        const existing = db.prepare(`${SALARY_SELECT} AND ts.id = ?`).get(id);
        if (!existing) {
            return reply.code(404).send({
                success: false,
                error: 'Salary record not found',
            });
        }
        const { salaryPaid, paymentDate, paymentMethod, notes, } = request.body;
        if (salaryPaid === undefined &&
            paymentDate === undefined &&
            paymentMethod === undefined &&
            notes === undefined) {
            return reply.code(400).send({
                success: false,
                error: 'No changes supplied',
            });
        }
        if (salaryPaid !== undefined && salaryPaid > Number(existing.salary_due)) {
            return reply.code(400).send({
                success: false,
                error: 'Salary paid cannot exceed salary due',
            });
        }
        const sets = [];
        const params = [];
        if (salaryPaid !== undefined) {
            sets.push('salary_paid = ?');
            params.push(salaryPaid);
        }
        if (paymentDate !== undefined) {
            sets.push('payment_date = ?');
            params.push(paymentDate);
        }
        if (paymentMethod !== undefined) {
            sets.push('payment_method = ?');
            params.push(paymentMethod);
        }
        if (notes !== undefined) {
            sets.push('notes = ?');
            params.push(notes?.trim() || null);
        }
        sets.push(`updated_at = CURRENT_TIMESTAMP`);
        params.push(id);
        db.prepare(`
      UPDATE teacher_salaries
      SET ${sets.join(', ')}
      WHERE id = ?
    `).run(...params);
        const updated = db.prepare(`${SALARY_SELECT} AND ts.id = ?`).get(id);
        return reply.send({
            success: true,
            data: toSalary(updated),
        });
    });
}
//# sourceMappingURL=salaries.js.map