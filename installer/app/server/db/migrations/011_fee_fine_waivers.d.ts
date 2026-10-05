/**
 * Migration 011 ? Fee Fine Waivers
 *
 * Adds audit-safe fine waiver information to student fee records.
 * The original fine_amount is preserved; waiver data is stored separately.
 */
import type { DatabaseSync } from 'node:sqlite';
export declare const id = "011_fee_fine_waivers";
export declare function up(db: DatabaseSync): void;
//# sourceMappingURL=011_fee_fine_waivers.d.ts.map