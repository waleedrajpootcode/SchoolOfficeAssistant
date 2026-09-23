/**
 * Attendance routes
 *
 * GET  /api/attendance?classId=&attendanceDate=
 *       — Admin: any class
 *       — Teacher: only assigned classes
 *
 * POST /api/attendance
 *       — Bulk upsert attendance for one class on one date
 *       — Teacher: only for assigned classes; students must belong to that class
 *       — Admin: any class
 *       — Transactional (BEGIN / COMMIT / ROLLBACK)
 */
import type { FastifyInstance } from 'fastify';
export declare function attendanceRoutes(fastify: FastifyInstance): Promise<void>;
//# sourceMappingURL=attendance.d.ts.map