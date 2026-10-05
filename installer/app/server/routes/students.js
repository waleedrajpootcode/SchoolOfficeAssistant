/**
 * Students routes (admin only)
 *
 * GET    /api/students          — list all students (optionally filter by classId)
 * POST   /api/students          — create a student
 * PATCH  /api/students/:id      — update student details
 * DELETE /api/students/:id      — soft deactivate
 */
import { getDatabase } from '../db/database.js';
import { requireAdmin } from '../hooks/authenticate.js';
function toStudentSummary(row) {
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
export async function studentRoutes(fastify) {
    fastify.addHook('preHandler', requireAdmin);
    // ── GET /api/students  ─────────────────────────────────────────────────────
    fastify.get('/', async (request, reply) => {
        const db = getDatabase();
        const rawClassId = request.query.classId;
        let classIdFilter = null;
        if (rawClassId !== undefined) {
            const parsedClassId = Number(rawClassId);
            if (!Number.isInteger(parsedClassId) || parsedClassId < 1) {
                return reply.code(400).send({ success: false, error: 'classId must be a positive integer' });
            }
            classIdFilter = parsedClassId;
        }
        let sql = `
        SELECT s.id, s.roll_number, s.full_name, s.guardian_name, s.guardian_phone,
               s.class_id, c.name AS class_name, s.is_active, s.created_at, s.updated_at
        FROM students s
        JOIN classes c ON c.id = s.class_id
      `;
        const params = [];
        if (classIdFilter !== null) {
            sql += ' WHERE s.class_id = ?';
            params.push(classIdFilter);
        }
        sql += ' ORDER BY s.roll_number';
        const rows = db.prepare(sql).all(...params);
        return reply.send({ success: true, data: rows.map(toStudentSummary) });
    });
    // ── POST /api/students  ────────────────────────────────────────────────────
    fastify.post('/', {
        schema: {
            body: {
                type: 'object',
                required: ['rollNumber', 'fullName', 'guardianName', 'classId'],
                properties: {
                    rollNumber: { type: 'string', minLength: 1, maxLength: 50 },
                    fullName: { type: 'string', minLength: 1, maxLength: 150 },
                    guardianName: { type: 'string', minLength: 1, maxLength: 150 },
                    guardianPhone: { type: 'string', maxLength: 30 },
                    classId: { type: 'integer', minimum: 1 },
                    familyId: { type: 'integer', minimum: 1 },
                },
            },
        },
    }, async (request, reply) => {
        const { rollNumber, fullName, guardianName, guardianPhone, classId, familyId } = request.body;
        const db = getDatabase();
        // Validate family when supplied
        if (familyId !== undefined) {
            const family = db
                .prepare('SELECT id FROM families WHERE id = ? AND is_active = 1')
                .get(familyId);
            if (!family) {
                return reply.code(400).send({ success: false, error: 'Family not found or inactive' });
            }
        }
        // Validate class exists
        const cls = db.prepare('SELECT id FROM classes WHERE id = ? AND is_active = 1').get(classId);
        if (!cls) {
            return reply.code(400).send({ success: false, error: 'Class not found or inactive' });
        }
        // Unique roll number
        const dup = db.prepare('SELECT id FROM students WHERE roll_number = ?').get(rollNumber);
        if (dup) {
            return reply.code(409).send({ success: false, error: 'Roll number already exists' });
        }
        const result = db.prepare(`INSERT INTO students (roll_number, full_name, guardian_name, guardian_phone, class_id, family_id)
         VALUES (?, ?, ?, ?, ?, ?)`).run(rollNumber, fullName, guardianName, guardianPhone ?? null, classId, familyId ?? null);
        const newRow = db.prepare(`SELECT s.id, s.roll_number, s.full_name, s.guardian_name, s.guardian_phone,
                s.class_id, c.name AS class_name, s.is_active, s.created_at, s.updated_at
         FROM students s JOIN classes c ON c.id = s.class_id WHERE s.id = ?`).get(result.lastInsertRowid);
        return reply.code(201).send({ success: true, data: toStudentSummary(newRow) });
    });
    // ── PATCH /api/students/:id  ───────────────────────────────────────────────
    fastify.patch('/:id', {
        schema: {
            body: {
                type: 'object',
                properties: {
                    rollNumber: { type: 'string', minLength: 1, maxLength: 50 },
                    fullName: { type: 'string', minLength: 1, maxLength: 150 },
                    guardianName: { type: 'string', minLength: 1, maxLength: 150 },
                    guardianPhone: { type: 'string', maxLength: 30 },
                    classId: { type: 'integer', minimum: 1 },
                    isActive: { type: 'boolean' },
                },
            },
        },
    }, async (request, reply) => {
        const studentId = Number(request.params.id);
        if (!Number.isInteger(studentId) || studentId < 1) {
            return reply.code(400).send({ success: false, error: 'Invalid student id' });
        }
        const db = getDatabase();
        const existing = db.prepare('SELECT id FROM students WHERE id = ?').get(studentId);
        if (!existing) {
            return reply.code(404).send({ success: false, error: 'Student not found' });
        }
        const { rollNumber, fullName, guardianName, guardianPhone, classId, isActive } = request.body;
        const sets = ["updated_at = datetime('now')"];
        const params = [];
        if (rollNumber !== undefined) {
            const dup = db.prepare('SELECT id FROM students WHERE roll_number = ? AND id != ?').get(rollNumber, studentId);
            if (dup)
                return reply.code(409).send({ success: false, error: 'Roll number already exists' });
            sets.push('roll_number = ?');
            params.push(rollNumber);
        }
        if (fullName !== undefined) {
            sets.push('full_name = ?');
            params.push(fullName);
        }
        if (guardianName !== undefined) {
            sets.push('guardian_name = ?');
            params.push(guardianName);
        }
        if (guardianPhone !== undefined) {
            sets.push('guardian_phone = ?');
            params.push(guardianPhone);
        }
        if (classId !== undefined) {
            const cls = db.prepare('SELECT id FROM classes WHERE id = ? AND is_active = 1').get(classId);
            if (!cls)
                return reply.code(400).send({ success: false, error: 'Class not found or inactive' });
            sets.push('class_id = ?');
            params.push(classId);
        }
        if (isActive !== undefined) {
            sets.push('is_active = ?');
            params.push(isActive ? 1 : 0);
        }
        if (sets.length === 1) {
            return reply.code(400).send({ success: false, error: 'No fields to update' });
        }
        params.push(studentId);
        db.prepare(`UPDATE students SET ${sets.join(', ')} WHERE id = ?`).run(...params);
        const updated = db.prepare(`SELECT s.id, s.roll_number, s.full_name, s.guardian_name, s.guardian_phone,
                s.class_id, c.name AS class_name, s.is_active, s.created_at, s.updated_at
         FROM students s JOIN classes c ON c.id = s.class_id WHERE s.id = ?`).get(studentId);
        return reply.send({ success: true, data: toStudentSummary(updated) });
    });
    // ── DELETE /api/students/:id  ──────────────────────────────────────────────
    fastify.delete('/:id', async (request, reply) => {
        const studentId = Number(request.params.id);
        if (!Number.isInteger(studentId) || studentId < 1) {
            return reply.code(400).send({ success: false, error: 'Invalid student id' });
        }
        const db = getDatabase();
        const existing = db.prepare('SELECT id FROM students WHERE id = ?').get(studentId);
        if (!existing) {
            return reply.code(404).send({ success: false, error: 'Student not found' });
        }
        db.prepare(`UPDATE students SET is_active = 0, updated_at = datetime('now') WHERE id = ?`).run(studentId);
        return reply.send({ success: true });
    });
}
//# sourceMappingURL=students.js.map