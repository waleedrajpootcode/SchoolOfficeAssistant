/**
 * Fastify request type augmentation.
 *
 * Declares request.user so auth middleware (Phase 2B) can attach the
 * authenticated user to every protected request in a fully type-safe way.
 *
 * The property is optional here because unauthenticated routes (e.g. /health,
 * /auth/login) do not populate it. Auth middleware will set it before any
 * protected route handler runs.
 */

import 'fastify';

declare module 'fastify' {
  interface FastifyRequest {
    /**
     * Populated by the authentication preHandler hook on protected routes.
     * Undefined on public routes (health, login).
     */
    user?: {
      id: number;
      role: 'admin' | 'teacher';
    };
  }
}
