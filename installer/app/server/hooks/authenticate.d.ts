/**
 * Authentication preHandler hook.
 *
 * Extracts the session token from the Authorization header (Bearer) or the
 * session cookie, verifies it against the sessions table, and attaches the
 * resolved user to request.user.
 *
 * Role is always resolved server-side from the database — never trusted from
 * the client.
 *
 * Usage on a protected route:
 *   fastify.get('/protected', { preHandler: [authenticate] }, handler)
 *
 * Usage via plugin (applies to all routes in a scope):
 *   fastify.addHook('preHandler', authenticate)
 */
import type { FastifyRequest, FastifyReply } from 'fastify';
/**
 * Fastify preHandler: authenticate the request.
 * Sends 401 and stops processing if the session is missing, invalid, or expired.
 */
export declare function authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void>;
/**
 * Fastify preHandler: authenticate AND require admin role.
 * Sends 401 if not authenticated, 403 if authenticated but not admin.
 */
export declare function requireAdmin(request: FastifyRequest, reply: FastifyReply): Promise<void>;
//# sourceMappingURL=authenticate.d.ts.map