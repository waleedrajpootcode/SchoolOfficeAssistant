/**
 * Authentication routes
 *
 * POST /api/auth/login   — verify credentials, create session, set cookie
 * POST /api/auth/logout  — revoke session, clear cookie
 * GET  /api/auth/me      — return the currently authenticated user
 */
import type { FastifyInstance } from 'fastify';
export declare function authRoutes(fastify: FastifyInstance): Promise<void>;
//# sourceMappingURL=auth.d.ts.map