/**
 * Migration 004 — School Settings
 *
 * Stores the single school's local installation settings.
 * One row is used for the school configuration.
 */
export const id = '004_school_settings';
export function up(db) {
    db.exec(`
    CREATE TABLE IF NOT EXISTS school_settings (
      id              INTEGER PRIMARY KEY CHECK (id = 1),
      school_name     TEXT    NOT NULL,
      school_address  TEXT,
      phone           TEXT,
      email           TEXT,
      principal_name  TEXT,
      academic_year   TEXT,
      setup_completed INTEGER NOT NULL DEFAULT 0
                      CHECK (setup_completed IN (0, 1)),
      created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
    )
  `);
    db.exec(`
    INSERT OR IGNORE INTO school_settings (
      id,
      school_name,
      setup_completed
    )
    VALUES (
      1,
      '',
      0
    )
  `);
}
//# sourceMappingURL=004_school_settings.js.map