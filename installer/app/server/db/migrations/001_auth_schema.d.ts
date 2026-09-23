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
import type { DatabaseSync } from 'node:sqlite';
export declare const id = "001_auth_schema";
export declare function up(db: DatabaseSync): void;
//# sourceMappingURL=001_auth_schema.d.ts.map