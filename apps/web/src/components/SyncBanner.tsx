import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  checkServerOnline,
  flushPending,
  listPending,
  onConnectivityChange,
  queueAttendance,
  setKnownOnline,
  type PendingAttendance,
} from '../lib/offlineQueue.js';
import { s, colors } from '../styles/shared.js';
import type { CSSProperties } from 'react';

interface Props {
  /** Called after a flush changes the pending set so pages can refresh data. */
  onSynced?: () => void;
}

export function SyncBanner({ onSynced }: Props) {
  const [online, setOnline] = useState<boolean>(true);
  const [pending, setPending] = useState<PendingAttendance[]>([]);
  const [flushing, setFlushing] = useState(false);
  const [ticker, setTicker] = useState(0);
  const onSyncedRef = useRef(onSynced);
  onSyncedRef.current = onSynced;

  const refreshPending = useCallback(() => {
    listPending().then(setPending);
  }, []);

  useEffect(() => {
    refreshPending();
    const unsub = onConnectivityChange((isOnline) => {
      setKnownOnline(isOnline);
      setOnline(isOnline);
    });
    const poll = window.setInterval(() => {
      checkServerOnline().then((ok) => setOnline(ok));
      setTicker((t) => t + 1);
    }, 20000);
    return () => {
      unsub();
      window.clearInterval(poll);
    };
  }, [refreshPending]);

  useEffect(() => {
    refreshPending();
  }, [ticker, refreshPending]);

  // Auto-flush when connectivity is restored.
  useEffect(() => {
    if (online && pending.length > 0) {
      runFlush();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online, pending.length]);

  async function runFlush() {
    if (flushing) return;
    setFlushing(true);
    const result = await flushPending();
    setFlushing(false);
    refreshPending();
    if (result.synced > 0) onSyncedRef.current?.();
  }

  async function requeueFailed(item: PendingAttendance) {
    await queueAttendance({
      classId: item.classId,
      attendanceDate: item.attendanceDate,
      records: item.records,
    });
    refreshPending();
  }

  if (online && pending.length === 0) return null;

  const offlineStyle: CSSProperties = {
    background: '#fef3e2',
    color: '#7c4a03',
    border: `1px solid ${colors.warning}`,
  };

  return (
    <div
      style={{
        ...s.card,
        ...(online ? { background: '#eef4ff', border: `1px solid ${colors.info}` } : offlineStyle),
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>
          {online ? 'Pending Sync' : 'Offline mode'}
        </span>
        <span style={{ ...s.badge, ...(online ? s.badgeBlue : s.badgeAmber) }}>
          {online ? 'Online' : 'Offline'}
        </span>
        <span style={{ ...s.badge, ...s.badgeGrey }}>
          {pending.length} queued
          {flushing ? ' · syncing…' : ''}
        </span>
        {!online && (
          <span style={{ fontSize: '0.82rem', color: '#7c4a03' }}>
            Attendance records are saved on this device and will sync automatically when the office server is reachable.
          </span>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          <button type="button" style={{ ...s.btnSecondary, ...s.btnSmall }} onClick={runFlush} disabled={flushing || !online}>
            {flushing ? 'Syncing…' : 'Sync now'}
          </button>
          {pending.length > 0 && pending.some((p) => p.status === 'failed') && (
            <button
              type="button"
              style={{ ...s.btnSecondary, ...s.btnSmall }}
              onClick={() => pending.filter((p) => p.status === 'failed').forEach(requeueFailed)}
            >
              Requeue failed
            </button>
          )}
        </div>
      </div>

      {pending.length > 0 && (
        <div style={{ marginTop: '0.6rem' }}>
          {pending.map((p) => (
            <div key={p.key} style={{ display: 'flex', gap: '0.5rem', alignItems: 'baseline', fontSize: '0.85rem' }}>
              <span>
                Class #{p.classId} · {p.attendanceDate} · {p.records.length} students
              </span>
              <span style={{ ...s.badge, ...(p.status === 'failed' ? s.badgeRed : s.badgeAmber) }}>
                {p.status === 'failed' ? 'Failed' : 'Pending'}
              </span>
              {p.status === 'failed' && p.syncError && (
                <span style={{ color: '#7c2d12', fontSize: '0.8rem' }}>{p.syncError}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}