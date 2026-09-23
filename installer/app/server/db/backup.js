/// <reference types="node" />
import { DatabaseSync } from 'node:sqlite';
import { copyFileSync, mkdirSync, unlinkSync, existsSync, } from 'node:fs';
import path from 'node:path';
import { DB_PATH, getDatabase, closeDatabase } from './database.js';
const BACKUP_DIR = path.join(path.dirname(DB_PATH), 'backups');
export function createDatabaseBackup() {
    const db = getDatabase();
    mkdirSync(BACKUP_DIR, { recursive: true });
    const timestamp = new Date()
        .toISOString()
        .replace(/[:.]/g, '-');
    const backupPath = path.join(BACKUP_DIR, `school-${timestamp}.sqlite`);
    db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
    copyFileSync(DB_PATH, backupPath);
    return backupPath;
}
export function validateDatabaseBackup(filePath) {
    let testDb = null;
    try {
        testDb = new DatabaseSync(filePath);
        const result = testDb
            .prepare('PRAGMA integrity_check')
            .get();
        return result?.integrity_check === 'ok';
    }
    finally {
        testDb?.close();
    }
}
export function removeDatabaseBackup(filePath) {
    const resolvedPath = path.resolve(filePath);
    const resolvedBackupDir = path.resolve(BACKUP_DIR);
    if (path.dirname(resolvedPath) !== resolvedBackupDir) {
        throw new Error('Only database backups can be removed.');
    }
    unlinkSync(resolvedPath);
}
export function restoreDatabaseBackup(backupPath) {
    const resolvedBackupPath = path.resolve(backupPath);
    const resolvedBackupDir = path.resolve(BACKUP_DIR);
    if (path.dirname(resolvedBackupPath) !== resolvedBackupDir) {
        throw new Error('Restore source must be inside the backup directory.');
    }
    if (!existsSync(resolvedBackupPath)) {
        throw new Error('Backup file does not exist.');
    }
    if (!validateDatabaseBackup(resolvedBackupPath)) {
        throw new Error('Backup failed SQLite integrity validation.');
    }
    const timestamp = new Date()
        .toISOString()
        .replace(/[:.]/g, '-');
    const protectedCurrentDb = path.join(BACKUP_DIR, `pre-restore-${timestamp}.sqlite`);
    const stagedRestoreDb = path.join(BACKUP_DIR, `restore-staged-${timestamp}.sqlite`);
    // Close the current process's SQLite connection.
    closeDatabase();
    // Stage the backup first so the live database is not touched
    // until the replacement file has been fully copied and validated.
    copyFileSync(resolvedBackupPath, stagedRestoreDb);
    if (!validateDatabaseBackup(stagedRestoreDb)) {
        unlinkSync(stagedRestoreDb);
        throw new Error('Staged restore database failed SQLite integrity validation.');
    }
    try {
        // Remove stale WAL/SHM files only after the staged database
        // has already been safely prepared.
        for (const suffix of ['-wal', '-shm']) {
            const sidecar = `${DB_PATH}${suffix}`;
            if (existsSync(sidecar)) {
                unlinkSync(sidecar);
            }
        }
        // Protect the current live database.
        copyFileSync(DB_PATH, protectedCurrentDb);
        // Replace the live database with the validated staged database.
        unlinkSync(DB_PATH);
        copyFileSync(stagedRestoreDb, DB_PATH);
        // Verify the restored live database before declaring success.
        if (!validateDatabaseBackup(DB_PATH)) {
            // Restore the protected database if verification fails.
            unlinkSync(DB_PATH);
            copyFileSync(protectedCurrentDb, DB_PATH);
            throw new Error('Restored database failed SQLite integrity validation. Original database was restored.');
        }
        return protectedCurrentDb;
    }
    finally {
        if (existsSync(stagedRestoreDb)) {
            unlinkSync(stagedRestoreDb);
        }
    }
}
//# sourceMappingURL=backup.js.map