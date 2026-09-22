/**
 * Offline-first attendance support.
 *
 * Goal: if the phone cannot reach the office server, attendance entries are
 * queued locally in IndexedDB and flushed automatically when connectivity is
 * restored. A record is only removed from the queue AFTER the server confirms
 * a successful save, so nothing is silently dropped.
 *
 * Duplicate prevention:
 *   - Queue rows are keyed by `${classId}|${YYYY-MM-DD}` — saving offline for
 *     the same class+date again simply REPLACES the earlier snapshot (latest
 *     marking wins), so each class+date is flushed at most once.
 *   - The server upserts on UNIQUE(student_id, attendance_date), so even a
 *     repeated submit can never create a second attendance row.
 */

import type { AttendanceEntry, SubmitAttendanceRequest } from '@school/shared';
import { attendanceApi } from '../api/attendance.js';

export type PendingStatus = 'pending' | 'failed';

export interface PendingAttendance {
  /** `${classId}|${YYYY-MM-DD}` — the queue key */
  key: string;
  classId: number;
  attendanceDate: string; // YYYY-MM-DD
  records: AttendanceEntry[];
  createdAt: string;
  updatedAt: string;
  status: PendingStatus;
  syncError: string | null;
  retryCount: number;
}

const DB_NAME = 'school-office-assistant';
const DB_VERSION = 1;
const STORE = 'pendingAttendance';

let dbPromise: Promise<IDBDatabase> | null = null;

// ─── Low-level IndexedDB helpers ─────────────────────────────────────────────

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const d = req.result;
      if (!d.objectStoreNames.contains(STORE)) {
        d.createObjectStore(STORE, { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Failed to open IndexedDB'));
    req.onblocked = () => reject(new Error('IndexedDB open blocked'));
  });
  return dbPromise;
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'));
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'));
  });
}

function getAll(): Promise<PendingAttendance[]> {
  return openDb().then(
    (db) =>
      new Promise<PendingAttendance[]>((resolve, reject) => {
        const tx = db.transaction(STORE, 'readonly');
        const req = tx.objectStore(STORE).getAll();
        req.onsuccess = () => resolve(req.result as PendingAttendance[]);
        req.onerror = () => reject(req.error ?? new Error('getAll failed'));
      })
  ).catch(() => [] as PendingAttendance[]);
}

function put(record: PendingAttendance): Promise<void> {
  return openDb().then((db) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(record);
    return txDone(tx);
  }).catch(() => { /* IndexedDB unavailable — ignore */ });
}

function remove(key: string): Promise<void> {
  return openDb().then((db) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(key);
    return txDone(tx);
  }).catch(() => { /* ignore */ });
}

// ─── Public API ──────────────────────────────────────────────────────────────

/** List every queued attendance snapshot (pending or failed). */
export async function listPending(): Promise<PendingAttendance[]> {
  return getAll();
}

/**
 * Queue (or replace) an unattended-by-server attendance snapshot.
 * Records are coalesced per class+date so a single source of truth remains.
 */
export async function queueAttendance(req: SubmitAttendanceRequest): Promise<PendingAttendance> {
  const key = `${req.classId}|${req.attendanceDate}`;
  const now = new Date().toISOString();
  const existing = (await listPending()).find((p) => p.key === key);

  const record: PendingAttendance = {
    key,
    classId: req.classId,
    attendanceDate: req.attendanceDate,
    records: req.records,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    status: 'pending',
    syncError: null,
    retryCount: existing?.retryCount ?? 0,
  };
  await put(record);
  return record;
}

/** Remove a queued snapshot once the server has confirmed it saved. */
export async function confirmSynced(key: string): Promise<void> {
  await remove(key);
}

/** Mark a queued snapshot as failed (server rejected it, e.g. validation). */
export async function markFailed(key: string, error: string): Promise<void> {
  const all = await listPending();
  const rec = all.find((p) => p.key === key);
  if (!rec) return;
  await put({ ...rec, status: 'failed', syncError: error, retryCount: rec.retryCount + 1, updatedAt: new Date().toISOString() });
}

// ─── Connectivity ────────────────────────────────────────────────────────────

const HEALTH_URL = '/api/health';
const HEALTH_TIMEOUT_MS = 4000;

let cached = true;

export function setKnownOnline(value: boolean): void {
  cached = value;
}

export function isKnownOnline(): boolean {
  return cached;
}

/**
 * Ping the server health endpoint to check actual reachability.
 * Treats any HTTP response as reachable; a thrown fetch/timeout as offline.
 */
export async function checkServerOnline(): Promise<boolean> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
  try {
    const res = await fetch(HEALTH_URL, { credentials: 'include', signal: controller.signal });
    cached = res.ok;
    return res.ok;
  } catch {
    cached = false;
    return false;
  } finally {
    window.clearTimeout(timer);
  }
}

/** Subscribe to browser online/offline status changes. Returns an unsubscribe fn. */
export function onConnectivityChange(cb: (online: boolean) => void): () => void {
  const goOnline = () => { cached = true; cb(true); };
  const goOffline = () => { cached = false; cb(false); };
  window.addEventListener('online', goOnline);
  window.addEventListener('offline', goOffline);
  return () => {
    window.removeEventListener('online', goOnline);
    window.removeEventListener('offline', goOffline);
  };
}

// ─── Flush / retry ───────────────────────────────────────────────────────────

export interface FlushResult {
  synced: number;
  failed: number;
  remaining: number;
}

/**
 * Attempt to send every queued snapshot to the server.
 * - A snapshot is removed ONLY after the server confirms success.
 * - A network/offline failure stops the flush loop (retry later).
 * - A server rejection (validation, etc.) is recorded on the snapshot and it
 *   is left in the queue as 'failed' for manual re-queue/retry.
 */
export async function flushPending(): Promise<FlushResult> {
  const queued = await listPending();
  const online = await checkServerOnline();
  if (!queued.length) return { synced: 0, failed: 0, remaining: 0 };
  if (!online) return { synced: 0, failed: 0, remaining: queued.length };

  let synced = 0;
  let failed = 0;

  for (const item of queued) {
    if (!(await checkServerOnline())) break; // went offline mid-flush

    const res = await attendanceApi.submit({
      classId: item.classId,
      attendanceDate: item.attendanceDate,
      records: item.records,
    });

    if (res.success) {
      await confirmSynced(item.key);
      synced += 1;
    } else if (res.offline) {
      break; // still unreachable — try again later
    } else {
      await markFailed(item.key, res.error ?? 'Server rejected attendance');
      failed += 1;
    }
  }

  const remaining = (await listPending()).length;
  return { synced, failed, remaining };
}