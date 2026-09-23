/**
 * Fees routes
 *
 * Admin only:
 *   GET  /api/fees/structures     — list fee structures
 *   POST /api/fees/structures     — create a fee structure
 *   GET  /api/fees/student-fees   — list student fees
 *   POST /api/fees/student-fees   — create a student fee
 */
import type { FastifyInstance } from 'fastify';
export declare function feeRoutes(fastify: FastifyInstance): Promise<void>;
//# sourceMappingURL=fees.d.ts.map