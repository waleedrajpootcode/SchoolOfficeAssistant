/**
 * Authentication routes
 *
 * POST /api/auth/login   — verify credentials, create session, set cookie
 * POST /api/auth/logout  — revoke session, clear cookie
 * GET  /api/auth/me      — return the currently authenticated user
 */

import type { FastifyInstance } from 'fastify';
import type { ApiResponse, LoginRequest, LoginResponse, UserSummary } from '@school/shared';
import { getDatabase } from '../db/database.js';
import { verifyPassword } from '../lib/password.js';
import { createSession, revokeSession } from '../lib/session.js';
import { authenticate } from '../hooks/authenticate.js';

const COOKIE_NAME = 'session';
const COOKIE_MAX_AGE = 8 * 60 * 60; // 8 hours in seconds

/** DB row shape for a user joined with its role name */
interface UserRow {
  id: number;
  username: string;
  display_name: string;
  role: string;
  is_active: number;
  password_hash: string;
  created_at: string;
}

/** Map a DB row to the safe UserSummary shape (no password_hash) */
function toUserSummary(row: UserRow): UserSummary {
  return {
    id: Number(row.id),
    username: row.username,
    displayName: row.display_name,
    role: row.role as 'admin' | 'teacher',
    isActive: row.is_active === 1,
    createdAt: row.created_at,
  };
}

export async function authRoutes(fastify: FastifyInstance) {
  // ── POST /api/auth/login ───────────────────────────────────────────────────
  fastify.post<{ Body: LoginRequest; Reply: ApiResponse<LoginResponse> }>(
    '/login',
    {
      schema: {
        body: {
          type: 'object',
          required: ['username', 'password'],
          properties: {
            username: { type: 'string', minLength: 1 },
            password: { type: 'string', minLength: 1 },
          },
        },
      },
    },
    async (request, reply) => {
      const { username, password } = request.body;

      const db = getDatabase();
      const row = db.prepare(
        `SELECT u.id, u.username, u.display_name, u.password_hash,
                u.is_active, u.created_at, r.name AS role
         FROM users u
         JOIN roles r ON r.id = u.role_id
         WHERE u.username = ?`
      ).get(username) as UserRow | undefined;

      // Use a dummy hash for timing-safe comparison when user is not found.
      // The dummy must look like a valid stored hash but never match any password.
      const storedHash = row?.password_hash ?? 'ffffffffffffffffffffffffffffffff:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
      const passwordOk = verifyPassword(password, storedHash);

      if (!row || !passwordOk) {
        return reply.code(401).send({ success: false, error: 'Invalid username or password' });
      }

      if (row.is_active !== 1) {
        return reply.code(403).send({ success: false, error: 'Account is disabled' });
      }

      const rawToken = createSession(row.id);

      // Set HttpOnly session cookie
      reply.setCookie(COOKIE_NAME, rawToken, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        maxAge: COOKIE_MAX_AGE,
        // secure: true — enable when serving over HTTPS
      });

      return reply.send({
        success: true,
        data: { user: toUserSummary(row) },
      });
    }
  );

  // ── POST /api/auth/logout ──────────────────────────────────────────────────
  fastify.post<{ Reply: ApiResponse }>(
    '/logout',
    { preHandler: [authenticate] },
    async (request, reply) => {
      // Token may come from cookie or Authorization header
      const auth = request.headers.authorization;
      const rawToken =
        auth?.startsWith('Bearer ')
          ? auth.slice(7).trim()
          : (request.cookies?.[COOKIE_NAME] as string | undefined) ?? '';

      if (rawToken) revokeSession(rawToken);

      reply.clearCookie(COOKIE_NAME, { path: '/' });

      return reply.send({ success: true });
    }
  );

  // ── GET /api/auth/me ───────────────────────────────────────────────────────
  fastify.get<{ Reply: ApiResponse<{ user: UserSummary }> }>(
    '/me',
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { id } = request.user!;

      const db = getDatabase();
      const row = db.prepare(
        `SELECT u.id, u.username, u.display_name, u.is_active, u.created_at, r.name AS role
         FROM users u
         JOIN roles r ON r.id = u.role_id
         WHERE u.id = ?`
      ).get(id) as UserRow | undefined;

      if (!row) {
        return reply.code(401).send({ success: false, error: 'User not found' });
      }

      // Omit password_hash — row has it but toUserSummary won't include it
      return reply.send({
        success: true,
        data: { user: toUserSummary({ ...row, password_hash: '' }) },
      });
    }
  );
}
