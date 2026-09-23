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
export interface SessionUser {
    id: number;
    role: 'admin' | 'teacher';
}
/**
 * Generate a cryptographically random raw token.
 * Returns a hex string (64 chars = 32 bytes = 256 bits).
 * NEVER store this value — only its SHA-256 hash goes to the DB.
 */
export declare function generateToken(): string;
/**
 * Compute SHA-256 of a raw token hex string.
 * This is what gets stored in sessions.token_hash.
 */
export declare function hashToken(rawToken: string): string;
/**
 * Persist a new session for userId.
 * Returns the raw token — the caller must send this to the client.
 * Only the SHA-256 hash is written to the database.
 */
export declare function createSession(userId: number): string;
/**
 * Verify a raw token presented by the client.
 * Returns the associated SessionUser if the token is valid and not expired.
 * Returns null for any invalid, expired, or unknown token.
 */
export declare function verifySession(rawToken: string): SessionUser | null;
/**
 * Revoke a session by its raw token (e.g. on logout).
 * Safe to call with an unknown or already-revoked token.
 */
export declare function revokeSession(rawToken: string): void;
/**
 * Delete all expired sessions from the database.
 * Call at startup or periodically to keep the sessions table tidy.
 */
export declare function purgeExpiredSessions(): number;
//# sourceMappingURL=session.d.ts.map