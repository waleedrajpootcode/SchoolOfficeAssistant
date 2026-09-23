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
import { verifySession } from '../lib/session.js';
const BEARER_PREFIX = 'Bearer ';
const COOKIE_NAME = 'session';
/**
 * Extract the raw session token from the request.
 * Checks Authorization header first, then falls back to the session cookie.
 */
function extractToken(request) {
    const auth = request.headers.authorization;
    if (auth && auth.startsWith(BEARER_PREFIX)) {
        return auth.slice(BEARER_PREFIX.length).trim();
    }
    const cookieToken = request.cookies?.[COOKIE_NAME];
    if (typeof cookieToken === 'string' && cookieToken.length > 0) {
        return cookieToken;
    }
    return null;
}
/**
 * Fastify preHandler: authenticate the request.
 * Sends 401 and stops processing if the session is missing, invalid, or expired.
 */
export async function authenticate(request, reply) {
    const rawToken = extractToken(request);
    if (!rawToken) {
        return reply.code(401).send({ success: false, error: 'Authentication required' });
    }
    const sessionUser = verifySession(rawToken);
    if (!sessionUser) {
        return reply.code(401).send({ success: false, error: 'Invalid or expired session' });
    }
    request.user = sessionUser;
}
/**
 * Fastify preHandler: authenticate AND require admin role.
 * Sends 401 if not authenticated, 403 if authenticated but not admin.
 */
export async function requireAdmin(request, reply) {
    await authenticate(request, reply);
    if (reply.sent)
        return; // 401 was already sent
    if (request.user?.role !== 'admin') {
        return reply.code(403).send({ success: false, error: 'Admin access required' });
    }
}
//# sourceMappingURL=authenticate.js.map