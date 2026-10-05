import { getDatabase } from '../db/database.js';
import { requireAdmin } from '../hooks/authenticate.js';
function toFeeRule(row) {
    return {
        id: Number(row.id),
        feeStructureId: Number(row.fee_structure_id),
        feeName: row.fee_name,
        className: row.class_name,
        lastDateDay: row.last_date_day === null ? null : Number(row.last_date_day),
        fineStartDay: row.fine_start_day === null ? null : Number(row.fine_start_day),
        fineAmount: Math.max(0, Number(row.fine_amount ?? 0)),
        isActive: Number(row.is_active) === 1,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}
function validateRule(lastDateDay, fineStartDay, fineAmount) {
    if (lastDateDay !== null &&
        lastDateDay !== undefined &&
        (!Number.isInteger(lastDateDay) || lastDateDay < 1 || lastDateDay > 31)) {
        return 'Last Date must be between 1 and 31.';
    }
    if (fineStartDay !== null &&
        fineStartDay !== undefined &&
        (!Number.isInteger(fineStartDay) ||
            fineStartDay < 1 ||
            fineStartDay > 31)) {
        return 'Fine Start Date must be between 1 and 31.';
    }
    const normalizedFine = Math.max(0, Number(fineAmount ?? 0));
    if (normalizedFine > 0 && fineStartDay == null) {
        return 'Fine Start Date is required when Fine Amount is greater than 0.';
    }
    if (fineStartDay != null && lastDateDay == null) {
        return 'Last Date is required when Fine Start Date is configured.';
    }
    if (fineStartDay != null &&
        lastDateDay != null &&
        fineStartDay < lastDateDay) {
        return 'Fine Start Date cannot be before Last Date.';
    }
    return null;
}
export async function feeRuleRoutes(fastify) {
    fastify.addHook('preHandler', requireAdmin);
    // GET /api/fee-rules
    fastify.get('/', async (_request, reply) => {
        const db = getDatabase();
        const rows = db.prepare(`SELECT fr.id,
                fr.fee_structure_id,
                fs.fee_name,
                c.name AS class_name,
                fr.last_date_day,
                fr.fine_start_day,
                fr.fine_amount,
                fr.is_active,
                fr.created_at,
                fr.updated_at
         FROM fee_rules fr
         JOIN fee_structures fs
           ON fs.id = fr.fee_structure_id
         JOIN classes c
           ON c.id = fs.class_id
         ORDER BY c.name, fs.fee_name`).all();
        return reply.send({
            success: true,
            data: rows.map(toFeeRule),
        });
    });
    // POST /api/fee-rules
    fastify.post('/', {
        schema: {
            body: {
                type: 'object',
                required: ['feeStructureId'],
                properties: {
                    feeStructureId: {
                        type: 'integer',
                        minimum: 1,
                    },
                    lastDateDay: {
                        anyOf: [
                            { type: 'integer', minimum: 1, maximum: 31 },
                            { type: 'null' },
                        ],
                    },
                    fineStartDay: {
                        anyOf: [
                            { type: 'integer', minimum: 1, maximum: 31 },
                            { type: 'null' },
                        ],
                    },
                    fineAmount: {
                        type: 'integer',
                        minimum: 0,
                    },
                },
            },
        },
    }, async (request, reply) => {
        const { feeStructureId, lastDateDay = null, fineStartDay = null, fineAmount = 0, } = request.body;
        const validationError = validateRule(lastDateDay, fineStartDay, fineAmount);
        if (validationError) {
            return reply.code(400).send({
                success: false,
                error: validationError,
            });
        }
        const db = getDatabase();
        const structure = db.prepare(`SELECT id
         FROM fee_structures
         WHERE id = ? AND is_active = 1`).get(feeStructureId);
        if (!structure) {
            return reply.code(404).send({
                success: false,
                error: 'Fee structure not found or inactive.',
            });
        }
        const existing = db.prepare('SELECT id FROM fee_rules WHERE fee_structure_id = ?').get(feeStructureId);
        if (existing) {
            return reply.code(409).send({
                success: false,
                error: 'A fee rule already exists for this fee structure. Edit the existing rule instead.',
            });
        }
        const result = db.prepare(`INSERT INTO fee_rules (
          fee_structure_id,
          last_date_day,
          fine_start_day,
          fine_amount
        )
        VALUES (?, ?, ?, ?)`).run(feeStructureId, lastDateDay ?? null, fineStartDay ?? null, Math.max(0, Number(fineAmount ?? 0)));
        const row = db.prepare(`SELECT fr.id,
                fr.fee_structure_id,
                fs.fee_name,
                c.name AS class_name,
                fr.last_date_day,
                fr.fine_start_day,
                fr.fine_amount,
                fr.is_active,
                fr.created_at,
                fr.updated_at
         FROM fee_rules fr
         JOIN fee_structures fs
           ON fs.id = fr.fee_structure_id
         JOIN classes c
           ON c.id = fs.class_id
         WHERE fr.id = ?`).get(result.lastInsertRowid);
        return reply.code(201).send({
            success: true,
            data: toFeeRule(row),
        });
    });
    // PATCH /api/fee-rules/:id
    fastify.patch('/:id', {
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
                    lastDateDay: {
                        anyOf: [
                            { type: 'integer', minimum: 1, maximum: 31 },
                            { type: 'null' },
                        ],
                    },
                    fineStartDay: {
                        anyOf: [
                            { type: 'integer', minimum: 1, maximum: 31 },
                            { type: 'null' },
                        ],
                    },
                    fineAmount: {
                        type: 'integer',
                        minimum: 0,
                    },
                    isActive: {
                        type: 'boolean',
                    },
                },
            },
        },
    }, async (request, reply) => {
        const id = Number(request.params.id);
        const db = getDatabase();
        const existing = db.prepare(`SELECT id,
                last_date_day,
                fine_start_day,
                fine_amount,
                is_active
         FROM fee_rules
         WHERE id = ?`).get(id);
        if (!existing) {
            return reply.code(404).send({
                success: false,
                error: 'Fee rule not found.',
            });
        }
        const lastDateDay = request.body.lastDateDay !== undefined
            ? request.body.lastDateDay
            : existing.last_date_day;
        const fineStartDay = request.body.fineStartDay !== undefined
            ? request.body.fineStartDay
            : existing.fine_start_day;
        const fineAmount = request.body.fineAmount !== undefined
            ? request.body.fineAmount
            : existing.fine_amount;
        const validationError = validateRule(lastDateDay, fineStartDay, fineAmount);
        if (validationError) {
            return reply.code(400).send({
                success: false,
                error: validationError,
            });
        }
        const isActive = request.body.isActive !== undefined
            ? request.body.isActive
                ? 1
                : 0
            : existing.is_active;
        db.prepare(`UPDATE fee_rules
         SET last_date_day = ?,
             fine_start_day = ?,
             fine_amount = ?,
             is_active = ?,
             updated_at = datetime('now')
         WHERE id = ?`).run(lastDateDay ?? null, fineStartDay ?? null, Math.max(0, Number(fineAmount ?? 0)), isActive, id);
        const row = db.prepare(`SELECT fr.id,
                fr.fee_structure_id,
                fs.fee_name,
                c.name AS class_name,
                fr.last_date_day,
                fr.fine_start_day,
                fr.fine_amount,
                fr.is_active,
                fr.created_at,
                fr.updated_at
         FROM fee_rules fr
         JOIN fee_structures fs
           ON fs.id = fr.fee_structure_id
         JOIN classes c
           ON c.id = fs.class_id
         WHERE fr.id = ?`).get(id);
        return reply.send({
            success: true,
            data: toFeeRule(row),
        });
    });
    // DELETE /api/fee-rules/:id
    fastify.delete('/:id', {
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
    }, async (request, reply) => {
        const id = Number(request.params.id);
        const db = getDatabase();
        const existing = db.prepare('SELECT id FROM fee_rules WHERE id = ?').get(id);
        if (!existing) {
            return reply.code(404).send({
                success: false,
                error: 'Fee rule not found.',
            });
        }
        db.prepare('DELETE FROM fee_rules WHERE id = ?').run(id);
        return reply.send({
            success: true,
            data: { deleted: true },
        });
    });
}
//# sourceMappingURL=feeRules.js.map