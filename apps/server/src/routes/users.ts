/**
 * User management routes (admin only)
 *
 * GET    /api/users          — list all users
 * POST   /api/users          — create a new user
 * PATCH  /api/users/:id      — update display name, role, password, or active state
 * DELETE /api/users/:id      — deactivate (soft delete) a user
 */

import type { FastifyInstance } from 'fastify';
import type {
  ApiResponse,
  UserSummary,
  CreateUserRequest,
  UpdateUserRequest,
} from '@school/shared';
import { getDatabase } from '../db/database.js';
import { hashPassword } from '../lib/password.js';
import { requireAdmin } from '../hooks/authenticate.js';

/** DB row shape for a user joined with its role name */
interface UserRow {
  id: number;
  username: string;
  display_name: string;
  role: string;
  is_active: number;
  created_at: string;
}

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

export async function userRoutes(fastify: FastifyInstance) {
  // All routes in this plugin require admin
  fastify.addHook('preHandler', requireAdmin);

  // ── GET /api/users ─────────────────────────────────────────────────────────
  fastify.get<{ Reply: ApiResponse<UserSummary[]> }>('/', async (_request, reply) => {
    const db = getDatabase();
    const rows = db.prepare(
      `SELECT u.id, u.username, u.display_name, u.is_active, u.created_at, r.name AS role
       FROM users u
       JOIN roles r ON r.id = u.role_id
       ORDER BY u.id`
    ).all() as unknown as UserRow[];

    return reply.send({ success: true, data: rows.map(toUserSummary) });
  });

  // ── POST /api/users ────────────────────────────────────────────────────────
  fastify.post<{ Body: CreateUserRequest; Reply: ApiResponse<UserSummary> }>(
    '/',
    {
      schema: {
        body: {
          type: 'object',
          required: ['username', 'displayName', 'role', 'password'],
          properties: {
            username:    { type: 'string', minLength: 1, maxLength: 50 },
            displayName: { type: 'string', minLength: 1, maxLength: 100 },
            role:        { type: 'string', enum: ['admin', 'teacher'] },
            password:    { type: 'string', minLength: 6 },
          },
        },
      },
    },
    async (request, reply) => {
      const { username, displayName, role, password } = request.body;

      const db = getDatabase();

      // Check username uniqueness
      const existing = db.prepare(
        'SELECT id FROM users WHERE username = ?'
      ).get(username);
      if (existing) {
        return reply.code(409).send({ success: false, error: 'Username already exists' });
      }

      // Resolve role_id
      const roleRow = db.prepare('SELECT id FROM roles WHERE name = ?').get(role) as
        | { id: number }
        | undefined;
      if (!roleRow) {
        return reply.code(400).send({ success: false, error: 'Invalid role' });
      }

      const passwordHash = hashPassword(password);

      const result = db.prepare(
        `INSERT INTO users (username, display_name, role_id, password_hash)
         VALUES (?, ?, ?, ?)`
      ).run(username, displayName, roleRow.id, passwordHash);

      const newId = result.lastInsertRowid as number;
      const newRow = db.prepare(
        `SELECT u.id, u.username, u.display_name, u.is_active, u.created_at, r.name AS role
         FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = ?`
      ).get(newId) as unknown as UserRow;

      return reply.code(201).send({ success: true, data: toUserSummary(newRow) });
    }
  );

  // ── PATCH /api/users/:id ───────────────────────────────────────────────────
  fastify.patch<{
    Params: { id: string };
    Body: UpdateUserRequest;
    Reply: ApiResponse<UserSummary>;
  }>(
    '/:id',
    {
      schema: {
        body: {
          type: 'object',
          properties: {
            displayName: { type: 'string', minLength: 1, maxLength: 100 },
            role:        { type: 'string', enum: ['admin', 'teacher'] },
            password:    { type: 'string', minLength: 6 },
            isActive:    { type: 'boolean' },
          },
        },
      },
    },
    async (request, reply) => {
      const targetId = Number(request.params.id);
      if (!Number.isInteger(targetId) || targetId < 1) {
        return reply.code(400).send({ success: false, error: 'Invalid user id' });
      }

      const db = getDatabase();
      const existing = db.prepare(
        `SELECT u.id, u.username, u.display_name, u.is_active, u.created_at, r.name AS role
         FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = ?`
      ).get(targetId) as UserRow | undefined;

      if (!existing) {
        return reply.code(404).send({ success: false, error: 'User not found' });
      }

      // Prevent disabling the currently logged-in admin (would break their session)
      const currentUserId = request.user!.id;
      const { displayName, role, password, isActive } = request.body;

      if (targetId === currentUserId && isActive === false) {
        return reply
          .code(400)
          .send({ success: false, error: 'Cannot deactivate your own account' });
      }

      // Build update fields dynamically — only touch what was provided
      const sets: string[] = [];
      const params: (string | number)[] = [];

      if (displayName !== undefined) {
        sets.push('display_name = ?');
        params.push(displayName);
      }

      if (role !== undefined) {
        // Prevent self-role-demotion that would remove admin access mid-session
        if (targetId === currentUserId && role !== 'admin') {
          return reply
            .code(400)
            .send({ success: false, error: 'Cannot change your own role away from admin' });
        }
        const roleRow = db.prepare('SELECT id FROM roles WHERE name = ?').get(role) as
          | { id: number }
          | undefined;
        if (!roleRow) {
          return reply.code(400).send({ success: false, error: 'Invalid role' });
        }
        sets.push('role_id = ?');
        params.push(roleRow.id);
      }

      if (password !== undefined) {
        sets.push('password_hash = ?');
        params.push(hashPassword(password));
      }

      if (isActive !== undefined) {
        sets.push('is_active = ?');
        params.push(isActive ? 1 : 0);
      }

      if (sets.length === 0) {
        return reply.code(400).send({ success: false, error: 'No fields to update' });
      }

      params.push(targetId);
      db.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`).run(...params);

      const updated = db.prepare(
        `SELECT u.id, u.username, u.display_name, u.is_active, u.created_at, r.name AS role
         FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = ?`
      ).get(targetId) as unknown as UserRow;

      return reply.send({ success: true, data: toUserSummary(updated) });
    }
  );

  // ── DELETE /api/users/:id — soft deactivate ────────────────────────────────
  fastify.delete<{ Params: { id: string }; Reply: ApiResponse }>(
    '/:id',
    async (request, reply) => {
      const targetId = Number(request.params.id);
      if (!Number.isInteger(targetId) || targetId < 1) {
        return reply.code(400).send({ success: false, error: 'Invalid user id' });
      }

      // Prevent self-deactivation
      if (targetId === request.user!.id) {
        return reply
          .code(400)
          .send({ success: false, error: 'Cannot deactivate your own account' });
      }

      const db = getDatabase();
      const existing = db.prepare('SELECT id FROM users WHERE id = ?').get(targetId);
      if (!existing) {
        return reply.code(404).send({ success: false, error: 'User not found' });
      }

      db.prepare('UPDATE users SET is_active = 0 WHERE id = ?').run(targetId);

      return reply.send({ success: true });
    }
  );
}
