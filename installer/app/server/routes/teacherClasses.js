/**
 * Teacher-Class assignment routes
 *
 * Admin:
 *   GET    /api/teacher-classes              — list all assignments
 *   POST   /api/teacher-classes              — create assignment
 *   DELETE /api/teacher-classes/:tid/:cid    — remove assignment
 *
 * Teacher (any authenticated role):
 *   GET    /api/teacher-classes/mine         — own assignments (teacher_id from session)
 */
import { getDatabase } from '../db/database.js';
import { authenticate, requireAdmin } from '../hooks/authenticate.js';
function toAssignment(row) {
    return {
        teacherId: Number(row.teacher_id),
        teacherName: row.teacher_name,
        classId: Number(row.class_id),
        className: row.class_name,
    };
}
const ASSIGNMENT_QUERY = `
  SELECT tc.teacher_id, u.display_name AS teacher_name,
         tc.class_id,   c.name         AS class_name
  FROM teacher_classes tc
  JOIN users   u ON u.id = tc.teacher_id
  JOIN classes c ON c.id = tc.class_id
`;
export async function teacherClassRoutes(fastify) {
    // ── GET /api/teacher-classes/mine  (teacher reads own assignments) ────────
    fastify.get('/mine', { preHandler: [authenticate] }, async (request, reply) => {
        const db = getDatabase();
        const rows = db.prepare(ASSIGNMENT_QUERY + ' WHERE tc.teacher_id = ? AND c.is_active = 1 ORDER BY c.name').all(request.user.id);
        return reply.send({ success: true, data: rows.map(toAssignment) });
    });
    // ── GET /api/teacher-classes  (admin — all assignments) ───────────────────
    fastify.get('/', { preHandler: [requireAdmin] }, async (_request, reply) => {
        const db = getDatabase();
        const rows = db.prepare(ASSIGNMENT_QUERY + ' ORDER BY u.display_name, c.name').all();
        return reply.send({ success: true, data: rows.map(toAssignment) });
    });
    // ── POST /api/teacher-classes  (admin) ────────────────────────────────────
    fastify.post('/', {
        preHandler: [requireAdmin],
        schema: {
            body: {
                type: 'object',
                required: ['teacherId', 'classId'],
                properties: {
                    teacherId: { type: 'integer', minimum: 1 },
                    classId: { type: 'integer', minimum: 1 },
                },
            },
        },
    }, async (request, reply) => {
        const { teacherId, classId } = request.body;
        const db = getDatabase();
        // Validate teacher exists and is a teacher role
        const teacher = db.prepare(`SELECT u.id FROM users u
         JOIN roles r ON r.id = u.role_id
         WHERE u.id = ? AND r.name = 'teacher' AND u.is_active = 1`).get(teacherId);
        if (!teacher) {
            return reply.code(400).send({ success: false, error: 'Teacher not found or inactive' });
        }
        // Validate class exists and is active
        const cls = db.prepare('SELECT id FROM classes WHERE id = ? AND is_active = 1').get(classId);
        if (!cls) {
            return reply.code(400).send({ success: false, error: 'Class not found or inactive' });
        }
        // Check duplicate
        const dup = db.prepare('SELECT teacher_id FROM teacher_classes WHERE teacher_id = ? AND class_id = ?').get(teacherId, classId);
        if (dup) {
            return reply.code(409).send({ success: false, error: 'Assignment already exists' });
        }
        db.prepare('INSERT INTO teacher_classes (teacher_id, class_id) VALUES (?, ?)').run(teacherId, classId);
        const newRow = db.prepare(ASSIGNMENT_QUERY + ' WHERE tc.teacher_id = ? AND tc.class_id = ?').get(teacherId, classId);
        return reply.code(201).send({ success: true, data: toAssignment(newRow) });
    });
    // ── DELETE /api/teacher-classes/:teacherId/:classId  (admin) ─────────────
    fastify.delete('/:teacherId/:classId', { preHandler: [requireAdmin] }, async (request, reply) => {
        const teacherId = Number(request.params.teacherId);
        const classId = Number(request.params.classId);
        if (!Number.isInteger(teacherId) || teacherId < 1 ||
            !Number.isInteger(classId) || classId < 1) {
            return reply.code(400).send({ success: false, error: 'Invalid teacher or class id' });
        }
        const db = getDatabase();
        const existing = db.prepare('SELECT teacher_id FROM teacher_classes WHERE teacher_id = ? AND class_id = ?').get(teacherId, classId);
        if (!existing) {
            return reply.code(404).send({ success: false, error: 'Assignment not found' });
        }
        db.prepare('DELETE FROM teacher_classes WHERE teacher_id = ? AND class_id = ?').run(teacherId, classId);
        return reply.send({ success: true });
    });
}
//# sourceMappingURL=teacherClasses.js.map