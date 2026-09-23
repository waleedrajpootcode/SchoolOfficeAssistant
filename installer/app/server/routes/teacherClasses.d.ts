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
import type { FastifyInstance } from 'fastify';
export declare function teacherClassRoutes(fastify: FastifyInstance): Promise<void>;
//# sourceMappingURL=teacherClasses.d.ts.map