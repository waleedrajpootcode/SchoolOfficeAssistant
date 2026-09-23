import { getDatabase } from '../db/database.js';
import { requireAdmin } from '../hooks/authenticate.js';
function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
function isValidAcademicYear(value) {
    return /^\d{4}-\d{2}$/.test(value);
}
export async function settingsRoutes(server) {
    server.get('/settings', { preHandler: requireAdmin }, async (_request, reply) => {
        const db = getDatabase();
        const row = db.prepare(`
        SELECT
          id,
          school_name AS schoolName,
          school_address AS schoolAddress,
          phone,
          email,
          principal_name AS principalName,
          academic_year AS academicYear,
          setup_completed AS setupCompleted,
          created_at AS createdAt,
          updated_at AS updatedAt
        FROM school_settings
        WHERE id = 1
      `).get();
        if (!row) {
            return reply.code(404).send({
                success: false,
                error: 'School settings not found',
            });
        }
        return {
            success: true,
            data: {
                ...row,
                setupCompleted: Boolean(row.setupCompleted),
            },
        };
    });
    server.patch('/settings', { preHandler: requireAdmin }, async (request, reply) => {
        const body = (request.body ?? {});
        const schoolName = body.schoolName?.trim() ?? '';
        const schoolAddress = body.schoolAddress?.trim() ?? '';
        const phone = body.phone?.trim() ?? '';
        const email = body.email?.trim() ?? '';
        const principalName = body.principalName?.trim() ?? '';
        const academicYear = body.academicYear?.trim() ?? '';
        if (!schoolName) {
            return reply.code(400).send({
                success: false,
                error: 'School name is required',
            });
        }
        if (schoolName.length > 150) {
            return reply.code(400).send({
                success: false,
                error: 'School name must be 150 characters or less',
            });
        }
        if (schoolAddress.length > 300) {
            return reply.code(400).send({
                success: false,
                error: 'School address must be 300 characters or less',
            });
        }
        if (phone.length > 30) {
            return reply.code(400).send({
                success: false,
                error: 'Phone number must be 30 characters or less',
            });
        }
        if (email && !isValidEmail(email)) {
            return reply.code(400).send({
                success: false,
                error: 'Please enter a valid email address',
            });
        }
        if (email.length > 150) {
            return reply.code(400).send({
                success: false,
                error: 'Email must be 150 characters or less',
            });
        }
        if (principalName.length > 150) {
            return reply.code(400).send({
                success: false,
                error: 'Principal name must be 150 characters or less',
            });
        }
        if (academicYear && !isValidAcademicYear(academicYear)) {
            return reply.code(400).send({
                success: false,
                error: 'Academic year must use the format YYYY-YY, for example 2026-27',
            });
        }
        const db = getDatabase();
        const current = db.prepare(`
        SELECT id
        FROM school_settings
        WHERE id = 1
      `).get();
        if (!current) {
            return reply.code(404).send({
                success: false,
                error: 'School settings not found',
            });
        }
        /*
         * Once setup is completed, normal Settings updates must not
         * accidentally reset setupCompleted back to false.
         */
        const currentSettings = db.prepare(`
        SELECT setup_completed AS setupCompleted
        FROM school_settings
        WHERE id = 1
      `).get();
        const setupCompleted = currentSettings?.setupCompleted === 1 || body.setupCompleted === true
            ? 1
            : 0;
        db.prepare(`
        UPDATE school_settings
        SET
          school_name = ?,
          school_address = ?,
          phone = ?,
          email = ?,
          principal_name = ?,
          academic_year = ?,
          setup_completed = ?,
          updated_at = datetime('now')
        WHERE id = 1
      `).run(schoolName, schoolAddress || null, phone || null, email || null, principalName || null, academicYear || null, setupCompleted);
        const updated = db.prepare(`
        SELECT
          id,
          school_name AS schoolName,
          school_address AS schoolAddress,
          phone,
          email,
          principal_name AS principalName,
          academic_year AS academicYear,
          setup_completed AS setupCompleted,
          created_at AS createdAt,
          updated_at AS updatedAt
        FROM school_settings
        WHERE id = 1
      `).get();
        return {
            success: true,
            data: {
                ...updated,
                setupCompleted: Boolean(updated.setupCompleted),
            },
        };
    });
}
//# sourceMappingURL=settings.js.map