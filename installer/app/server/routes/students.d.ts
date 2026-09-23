/**
 * Students routes (admin only)
 *
 * GET    /api/students          — list all students (optionally filter by classId)
 * POST   /api/students          — create a student
 * PATCH  /api/students/:id      — update student details
 * DELETE /api/students/:id      — soft deactivate
 */
import type { FastifyInstance } from 'fastify';
export declare function studentRoutes(fastify: FastifyInstance): Promise<void>;
//# sourceMappingURL=students.d.ts.map