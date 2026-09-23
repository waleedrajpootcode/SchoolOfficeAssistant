import { DatabaseSync } from 'node:sqlite';
export declare const DB_PATH: string;
/**
 * Returns the singleton SQLite database connection.
 * Creates the database file and parent directory on first call.
 * Uses the built-in node:sqlite module (Node.js 22.5+) — no native build needed.
 */
export declare function getDatabase(): DatabaseSync;
export declare function closeDatabase(): void;
//# sourceMappingURL=database.d.ts.map