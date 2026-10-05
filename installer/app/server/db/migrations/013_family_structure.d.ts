/**
 * Migration 013 ? Family Structure
 *
 * Restores the base family schema required by the Families module.
 * Safe for existing databases: all schema creation is conditional and
 * existing student/fee/payment data is preserved.
 */
import type { DatabaseSync } from 'node:sqlite';
export declare const id = "013_family_structure";
export declare function up(db: DatabaseSync): void;
//# sourceMappingURL=013_family_structure.d.ts.map