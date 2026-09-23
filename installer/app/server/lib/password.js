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
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 };
const KEY_LEN = 64;
const SALT_LEN = 16;
const EXPECTED_PARTS = 2;
/**
 * Hash a plaintext password.
 * Returns a string in the form  "salt_hex:hash_hex".
 */
export function hashPassword(password) {
    if (!password || password.length === 0) {
        throw new Error('Password must not be empty');
    }
    const salt = randomBytes(SALT_LEN);
    const hash = scryptSync(password, salt, KEY_LEN, SCRYPT_PARAMS);
    return `${salt.toString('hex')}:${hash.toString('hex')}`;
}
/**
 * Verify a plaintext password against a stored hash string.
 * Uses timingSafeEqual to prevent timing attacks.
 * Returns false (never throws) on malformed stored hashes.
 */
export function verifyPassword(password, storedHash) {
    if (!password || !storedHash)
        return false;
    const parts = storedHash.split(':');
    if (parts.length !== EXPECTED_PARTS)
        return false;
    const [saltHex, hashHex] = parts;
    // Guard against malformed hex or unexpected buffer lengths
    try {
        const salt = Buffer.from(saltHex, 'hex');
        const expected = Buffer.from(hashHex, 'hex');
        if (salt.length !== SALT_LEN || expected.length !== KEY_LEN)
            return false;
        const actual = scryptSync(password, salt, KEY_LEN, SCRYPT_PARAMS);
        return timingSafeEqual(actual, expected);
    }
    catch {
        // Never propagate — malformed input should silently fail verification
        return false;
    }
}
//# sourceMappingURL=password.js.map