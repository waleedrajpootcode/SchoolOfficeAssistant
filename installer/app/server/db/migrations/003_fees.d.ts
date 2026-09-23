/**
 * Migration 003 — Fees
 *
 * Adds:
 * - fee_structures
 * - student_fees
 * - fee_payments
 *
 * Monthly fee tracking with payment history and receipt/reference numbers.
 */
import type { DatabaseSync } from 'node:sqlite';
export declare const id = "003_fees";
export declare function up(db: DatabaseSync): void;
//# sourceMappingURL=003_fees.d.ts.map