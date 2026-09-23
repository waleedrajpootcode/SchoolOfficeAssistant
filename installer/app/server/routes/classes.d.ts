/**
 * Classes routes
 *
 * Admin:
 *   GET    /api/classes          — list all classes
 *   POST   /api/classes          — create a class
 *   PATCH  /api/classes/:id      — update name/section/active
 *   DELETE /api/classes/:id      — soft deactivate
 *
 * Teacher (authenticated, any role):
 *   GET    /api/classes/mine     — list only assigned classes
 */
import type { FastifyInstance } from 'fastify';
export declare function classRoutes(fastify: FastifyInstance): Promise<void>;
//# sourceMappingURL=classes.d.ts.map