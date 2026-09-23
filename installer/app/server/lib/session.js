/**
 * Session / token utility — uses ONLY node:crypto (no external dependencies).
 *
 * Design:
 *   - A cryptographically random 32-byte raw token is generated per session.
 *   - The raw token is returned to the client ONCE and never stored.
 *   - SHA-256(raw token) is stored in the sessions table as token_hash.
 *   - Verification: SHA-256(presented token) vs stored hash via timingSafeEqual.
 *   - Sessions expire after SESSION_TTL_MS (default 8 hours).
 *   - Sessions are revocable by deleting their database row.
 *
 * NEVER log raw tokens.
 */
import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import { getDatabase } from '../db/database.js';
/** Session lifetime: 8 hours */
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
/** Length of the raw token in bytes (256 bits of entropy) */
const TOKEN_BYTES = 32;
// ─── Low-level helpers ────────────────────────────────────────────────────────
/**
 * Generate a cryptographically random raw token.
 * Returns a hex string (64 chars = 32 bytes = 256 bits).
 * NEVER store this value — only its SHA-256 hash goes to the DB.
 */
export function generateToken() {
    return randomBytes(TOKEN_BYTES).toString('hex');
}
/**
 * Compute SHA-256 of a raw token hex string.
 * This is what gets stored in sessions.token_hash.
 */
export function hashToken(rawToken) {
    return createHash('sha256').update(rawToken).digest('hex');
}
// ─── Database operations ─────────────────────────────────────────────────────
/**
 * Persist a new session for userId.
 * Returns the raw token — the caller must send this to the client.
 * Only the SHA-256 hash is written to the database.
 */
export function createSession(userId) {
    const rawToken = generateToken();
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
    const db = getDatabase();
    db.prepare('INSERT INTO sessions (user_id, token_hash, expires_at) VALUES (?, ?, ?)').run(userId, tokenHash, expiresAt);
    // rawToken intentionally not logged
    return rawToken;
}
/**
 * Verify a raw token presented by the client.
 * Returns the associated SessionUser if the token is valid and not expired.
 * Returns null for any invalid, expired, or unknown token.
 */
export function verifySession(rawToken) {
    if (!rawToken || rawToken.length !== TOKEN_BYTES * 2)
        return null;
    const presentedHash = hashToken(rawToken);
    const db = getDatabase();
    // Cast needed because node:sqlite's generic prepare<> signature doesn't
    // support typed output rows — the runtime values are correct.
    const row = db.prepare(`SELECT s.token_hash, s.expires_at, u.id AS user_id, r.name AS role, u.is_active
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     JOIN roles  r ON r.id = u.role_id
     WHERE s.token_hash = ?`).get(presentedHash);
    if (!row)
        return null;
    // Constant-time comparison as a second layer of defence
    const storedHashBuf = Buffer.from(row.token_hash, 'hex');
    const presentedHashBuf = Buffer.from(presentedHash, 'hex');
    if (storedHashBuf.length !== presentedHashBuf.length ||
        !timingSafeEqual(storedHashBuf, presentedHashBuf)) {
        return null;
    }
    // Reject expired sessions — clean up lazily so we don't block the request
    if (new Date(row.expires_at) <= new Date()) {
        revokeByHash(presentedHash);
        return null;
    }
    // Reject inactive users
    if (row.is_active !== 1)
        return null;
    const role = row.role;
    if (role !== 'admin' && role !== 'teacher')
        return null;
    return { id: Number(row.user_id), role: role };
}
/**
 * Revoke a session by its raw token (e.g. on logout).
 * Safe to call with an unknown or already-revoked token.
 */
export function revokeSession(rawToken) {
    if (!rawToken)
        return;
    revokeByHash(hashToken(rawToken));
}
/**
 * Delete all expired sessions from the database.
 * Call at startup or periodically to keep the sessions table tidy.
 */
export function purgeExpiredSessions() {
    const db = getDatabase();
    const result = db.prepare("DELETE FROM sessions WHERE expires_at <= datetime('now')").run();
    // result.changes is number at runtime; cast away @types/node's bigint union
    return result.changes;
}
// ─── Internal helpers ─────────────────────────────────────────────────────────
function revokeByHash(tokenHash) {
    try {
        getDatabase().prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash);
    }
    catch {
        // Best-effort cleanup — ignore errors
    }
}
//# sourceMappingURL=session.js.map