// Uses the built-in node:sqlite module available in Node.js 22.5+.
// No native compilation required — zero extra dependencies.
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Store the database file in the project root's data/ directory.
// Override via DB_PATH environment variable if needed.
// Resolve data/ relative to the project root.
// __dirname is …/src/db (tsx) or …/dist/db (compiled) — both are 4 levels
// below the repo root (server/src/db or server/dist/db → server → apps → root).
const DB_PATH =
  process.env.DB_PATH ??
  path.resolve(__dirname, '../../../../data/school.sqlite');

let db: DatabaseSync | null = null;

/**
 * Returns the singleton SQLite database connection.
 * Creates the database file and parent directory on first call.
 * Uses the built-in node:sqlite module (Node.js 22.5+) — no native build needed.
 */
export function getDatabase(): DatabaseSync {
  if (db) return db;

  // Ensure the data directory exists before opening the file
  mkdirSync(path.dirname(DB_PATH), { recursive: true });

  db = new DatabaseSync(DB_PATH);

  // WAL mode: better concurrent read performance
  db.exec('PRAGMA journal_mode = WAL');
  // Enforce foreign key constraints
  db.exec('PRAGMA foreign_keys = ON');

  return db;
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}
