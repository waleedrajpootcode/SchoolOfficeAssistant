/**
 * Migration 012 ? Family Payment Batches
 *
 * Groups multiple child fee payments into one family-level payment
 * while preserving each individual fee_payment history.
 */
import type { DatabaseSync } from 'node:sqlite';
export declare const id = "012_family_payment_batches";
export declare function up(db: DatabaseSync): void;
//# sourceMappingURL=012_family_payment_batches.d.ts.map