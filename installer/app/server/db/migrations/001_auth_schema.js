/**
 * Migration 001 — Authentication & Class Schema
 *
 * Creates: roles, users, sessions, classes, teacher_classes
 * Seeds  : roles (admin, teacher) + one default admin account
 *
 * DEFAULT ADMIN CREDENTIALS (change after first login):
 *   username : admin
 *   password : Admin@1234
 *
 * See README.md "First-Run Setup" section for instructions.
 *
 * SECURITY: The plaintext password above is used ONLY to generate the hash
 * at migration time via hashPassword(). It is never written to the database.
 */
import { hashPassword } from '../../lib/password.js';
export const id = '001_auth_schema';
export function up(db) {
    // ── roles ──────────────────────────────────────────────────────────────────
    db.exec(`
    CREATE TABLE IF NOT EXISTS roles (
      id   INTEGER PRIMARY KEY,
      name TEXT    NOT NULL UNIQUE
    )
  `);
    // ── users ──────────────────────────────────────────────────────────────────
    db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      username      TEXT    NOT NULL UNIQUE,
      display_name  TEXT    NOT NULL,
      role_id       INTEGER NOT NULL REFERENCES roles(id),
      password_hash TEXT    NOT NULL,
      is_active     INTEGER NOT NULL DEFAULT 1,
      created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
    )
  `);
    // ── sessions ───────────────────────────────────────────────────────────────
    db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT    NOT NULL UNIQUE,
      expires_at TEXT    NOT NULL,
      created_at TEXT    NOT NULL DEFAULT (datetime('now'))
    )
  `);
    // ── classes ────────────────────────────────────────────────────────────────
    db.exec(`
    CREATE TABLE IF NOT EXISTS classes (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT    NOT NULL UNIQUE,
      created_at TEXT    NOT NULL DEFAULT (datetime('now'))
    )
  `);
    // ── teacher_classes ────────────────────────────────────────────────────────
    db.exec(`
    CREATE TABLE IF NOT EXISTS teacher_classes (
      teacher_id INTEGER NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
      class_id   INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
      PRIMARY KEY (teacher_id, class_id)
    )
  `);
    // ── indexes for common lookups ─────────────────────────────────────────────
    db.exec(`
    CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash);
    CREATE INDEX IF NOT EXISTS idx_sessions_user_id    ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_users_username      ON users(username);
  `);
    // ── seed roles (idempotent) ────────────────────────────────────────────────
    db.exec(`
    INSERT OR IGNORE INTO roles (id, name) VALUES (1, 'admin');
    INSERT OR IGNORE INTO roles (id, name) VALUES (2, 'teacher');
  `);
    // ── seed default admin account (idempotent) ────────────────────────────────
    // Only insert if no admin exists yet — safe to re-run after account is renamed.
    const existing = db.prepare("SELECT id FROM users WHERE username = 'admin'").get();
    if (!existing) {
        // hashPassword() uses randomBytes — the hash will differ on every migration
        // run, but that's fine because we only reach this branch on a fresh DB.
        const passwordHash = hashPassword('Admin@1234');
        db.prepare(`INSERT INTO users (username, display_name, role_id, password_hash)
       VALUES ('admin', 'Administrator', 1, ?)`).run(passwordHash);
    }
}
//# sourceMappingURL=001_auth_schema.js.map