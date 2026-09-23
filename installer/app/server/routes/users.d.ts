/**
 * User management routes (admin only)
 *
 * GET    /api/users          — list all users
 * POST   /api/users          — create a new user
 * PATCH  /api/users/:id      — update display name, role, password, or active state
 * DELETE /api/users/:id      — deactivate (soft delete) a user
 */
import type { FastifyInstance } from 'fastify';
export declare function userRoutes(fastify: FastifyInstance): Promise<void>;
//# sourceMappingURL=users.d.ts.map