/**
 * Password hashing utility — uses ONLY node:crypto (no external dependencies).
 *
 * Algorithm : scrypt
 * Salt      : 16 random bytes (crypto.randomBytes)
 * Params    : N=16384, r=8, p=1  (OWASP interactive-login minimum)
 * Key length: 64 bytes
 * Storage   : "<salt_hex>:<hash_hex>"
 *
 * NEVER log passwords or password hashes.
 */
/**
 * Hash a plaintext password.
 * Returns a string in the form  "salt_hex:hash_hex".
 */
export declare function hashPassword(password: string): string;
/**
 * Verify a plaintext password against a stored hash string.
 * Uses timingSafeEqual to prevent timing attacks.
 * Returns false (never throws) on malformed stored hashes.
 */
export declare function verifyPassword(password: string, storedHash: string): boolean;
//# sourceMappingURL=password.d.ts.map