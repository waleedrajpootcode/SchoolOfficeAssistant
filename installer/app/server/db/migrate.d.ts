/**
 * Migration runner for School Office Assistant.
 *
 * How it works:
 *   1. Ensures a `_migrations` tracking table exists.
 *   2. Iterates the registered migration list in order.
 *   3. Skips any migration whose id is already recorded.
 *   4. Runs each pending migration inside a manual transaction (atomic).
 *   5. Records the completed migration id + timestamp.
 *
 * Safe to call on every server startup — idempotent by design.
 *
 * Note: node:sqlite's DatabaseSync does not expose a .transaction() helper;
 * we use raw BEGIN / COMMIT / ROLLBACK instead.
 */
/**
 * Run all pending migrations.
 * Called once at server startup before routes are registered.
 */
export declare function runMigrations(): void;
//# sourceMappingURL=migrate.d.ts.map