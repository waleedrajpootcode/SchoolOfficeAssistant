import React, { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import type {
  AttendanceRecord,
  AttendanceStatus,
  ClassSummary,
  StudentSummary,
} from '@school/shared';
import {
  todayLocalYYYYMMDD,
  isValidYYYYMMDD,
} from '@school/shared';
import { classesApi } from '../api/classes.js';
import { attendanceApi } from '../api/attendance.js';
import { useAuth } from '../context/AuthContext.js';
import { confirmSynced, queueAttendance } from '../lib/offlineQueue.js';
import { SyncBanner } from '../components/SyncBanner.js';
import { navigate, useRoute } from '../router.js';
import { s } from '../styles/shared.js';

const STATUS_OPTIONS: AttendanceStatus[] = ['present', 'absent', 'leave'];

function statusStyle(active: boolean): CSSProperties {
  const base: CSSProperties = {
    padding: '0.35rem 0.65rem',
    borderRadius: 5,
    fontSize: '0.8rem',
    fontWeight: 600,
    cursor: 'pointer',
    border: '1px solid #cbd5e1',
    background: active ? '#1a1a2e' : '#fff',
    color: active ? '#fff' : '#334155',
  };
  return base;
}

export function AttendancePage() {
  const { user } = useAuth();
  const { params } = useRoute();

  const [classes, setClasses] = useState<ClassSummary[]>([]);
  const [classId, setClassId] = useState<number | ''>(() => {
    const from = params.get('classId');
    const n = from ? Number(from) : NaN;
    return Number.isInteger(n) && n >= 1 ? n : '';
  });
  const [date, setDate] = useState<string>(todayLocalYYYYMMDD());

  const [roster, setRoster] = useState<StudentSummary[]>([]);
  const [savedMap, setSavedMap] = useState<Map<number, AttendanceStatus>>(new Map());
  const [marks, setMarks] = useState<Map<number, AttendanceStatus>>(new Map());

  const [loadingMeta, setLoadingMeta] = useState(true);
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [saving, setSaving] = useState(false);
  const [verb, setVerb] = useState<null | 'online' | 'offline'>(null);
  const [error, setError] = useState<string | null>(null);

  const isTeacher = user?.role === 'teacher';

  useEffect(() => {
    (isTeacher ? classesApi.listMine() : classesApi.list()).then((res) => {
      if (res.success && res.data) {
        const actives = res.data.filter(c => c.isActive);
        setClasses(actives);
        setClassId((current) => {
          if (current === '' && actives.length > 0) return actives[0].id;
          return current;
        });
      } else {
        setError(res.error ?? 'Failed to load classes');
      }
      setLoadingMeta(false);
    });
  }, [isTeacher]);

  const selectedClass = useMemo(
    () => classes.find(c => c.id === classId),
    [classes, classId]
  );

  useEffect(() => {
    if (classId === '' || !isValidYYYYMMDD(date)) return;
    let cancelled = false;
    setLoadingRoster(true);
    setError(null);
    setVerb(null);

    Promise.all([
      attendanceApi.roster(classId as number),
      attendanceApi.get({ classId: classId as number, attendanceDate: date }),
    ]).then(([rosterRes, recRes]) => {
      if (cancelled) return;
      if (rosterRes.success && rosterRes.data) setRoster(rosterRes.data);
      else setError(rosterRes.error ?? 'Failed to load roster');

      const saved = new Map<number, AttendanceStatus>();
      if (recRes.success && recRes.data) {
        for (const rec of recRes.data) saved.set(rec.studentId, rec.status);
      }
      setSavedMap(saved);

      setMarks((prev) => {
        const next = new Map<number, AttendanceStatus>();
        for (const st of (rosterRes.success && rosterRes.data) ? rosterRes.data : []) {
          const existing = saved.get(st.id);
          next.set(st.id, existing ?? prev.get(st.id) ?? 'present');
        }
        return next;
      });

      setLoadingRoster(false);
    });
    return () => { cancelled = true; };
  }, [classId, date]);

  function onChangeStatus(studentId: number, status: AttendanceStatus) {
    setMarks((prev) => {
      const next = new Map(prev);
      next.set(studentId, status);
      return next;
    });
  }

  const dirtyCount = useMemo(() => {
    let n = 0;
    for (const st of roster) {
      if ((marks.get(st.id) ?? 'present') !== (savedMap.get(st.id) ?? null)) n += 1;
    }
    return n;
  }, [roster, marks, savedMap]);

  async function handleSave() {
    if (classId === '' || roster.length === 0) return;
    setSaving(true);
    setError(null);
    setVerb(null);

    const records = roster.map(st => ({
      studentId: st.id,
      status: marks.get(st.id) ?? 'present',
    }));
    const payload = { classId: classId as number, attendanceDate: date, records };

    const key = `${payload.classId}|${payload.attendanceDate}`;
    const res = await attendanceApi.submit(payload);

    if (res.success) {
      await confirmSynced(key);
      const saved = new Map<number, AttendanceStatus>();
      if (res.data) for (const rec of res.data) saved.set(rec.studentId, rec.status);
      setSavedMap(saved);
      setMarks((prev) => {
        const next = new Map<number, AttendanceStatus>();
        for (const st of roster) next.set(st.id, saved.get(st.id) ?? prev.get(st.id) ?? 'present');
        return next;
      });
      setVerb('online');
    } else if (res.offline) {
      await queueAttendance(payload);
      setVerb('offline');
    } else {
      setError(res.error ?? 'Failed to save attendance');
    }
    setSaving(false);
  }

  const mobileAttendanceStyles = `
  @media (max-width: 700px) {
    .attendance-table th,
    .attendance-table td {
      padding: 0.45rem 0.35rem;
      font-size: 0.78rem;
    }

    .attendance-table th:nth-child(1),
    .attendance-table td:nth-child(1) {
      width: 18%;
    }

    .attendance-table th:nth-child(2),
    .attendance-table td:nth-child(2) {
      width: 32%;
      white-space: normal;
      overflow-wrap: anywhere;
    }

    .attendance-table th:nth-child(3),
    .attendance-table td:nth-child(3) {
      width: 50%;
    }

    .attendance-status-buttons {
      display: flex;
      flex-wrap: wrap;
      gap: 0.25rem;
    }

    .attendance-status-buttons button {
      min-width: 58px;
      min-height: 38px;
      padding: 0.35rem 0.4rem;
      font-size: 0.72rem;
    }
  }
`;

  return (
    <div>
      <div style={s.between}>
        <div>
          <h1 style={s.pageTitle}>Attendance</h1>
          <p style={s.muted}>
            {isTeacher
              ? 'Mark attendance for one of your assigned classes.'
              : 'View and record attendance for any class.'}
          </p>
        </div>
        {isTeacher && <button type="button" style={s.btnSecondary} onClick={() => navigate('my-classes')}>My Classes</button>}
      </div>

      <SyncBanner onSynced={() => undefined} />

      {/* ── Selectors ── */}
      <div style={{ ...s.card, ...s.row }}>
        <div style={{ ...s.field, flex: '2 1 220px' }}>
          <label style={s.label} htmlFor="attClass">Class</label>
          <select id="attClass" style={s.select} value={classId}
            onChange={e => setClassId(e.target.value === '' ? '' : Number(e.target.value))} disabled={loadingMeta}>
            <option value="">{loadingMeta ? 'Loading classes…' : 'Select class…'}</option>
            {classes.map(c => (
              <option key={c.id} value={c.id}>{c.name}{c.section ? ` · ${c.section}` : ''}</option>
            ))}
          </select>
        </div>
        <div style={{ ...s.field, flex: '1 1 160px' }}>
          <label style={s.label} htmlFor="attDate">Date</label>
          <input id="attDate" type="date" style={s.input} value={date}
            max={todayLocalYYYYMMDD()}
            onChange={e => e.target.value && setDate(e.target.value)} />
        </div>
      </div>

      {error && <p style={s.errText} role="alert">{error}</p>}
      {verb === 'online' && <p style={s.okText}>Attendance saved and synced to the office server.</p>}
      {verb === 'offline' && (
        <p style={{ color: '#7c4a03', fontSize: '0.875rem', margin: '0.5rem 0' }}>
          You are offline — attendance is saved on this device and will sync automatically when the office server is reachable.
        </p>
      )}

      {classId === '' ? (
        <div style={{ ...s.card, ...s.empty }}>
          {loadingMeta ? 'Loading…' : 'No active classes available.'}
        </div>
      ) : loadingRoster ? (
        <p style={s.spinner}>Loading roster…</p>
      ) : roster.length === 0 ? (
        <div style={{ ...s.card, ...s.empty }}>
          No active students in {selectedClass ? `${selectedClass.name}${selectedClass.section ? ` · ${selectedClass.section}` : ''}` : 'this class'}.
        </div>
      ) : (
        <>
          <div
  className="attendance-status-buttons"
  style={{
    display: 'flex',
    gap: '0.4rem',
    flexWrap: 'wrap',
  }}
>
            <table
  className="attendance-table"
  style={{
    ...s.table,
    width: '100%',
    minWidth: 0,
    tableLayout: 'fixed',
  }}
>
              <thead>
                <tr>
                  <th style={s.th}>Roll No</th>
                  <th style={s.th}>Name</th>
                  <th style={s.th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {roster.map(st => {
                  const status = marks.get(st.id) ?? 'present';
                  return (
                    <tr key={st.id}>
                      <td style={s.td}>{st.rollNumber}</td>
                      <td style={s.td}>{st.fullName}</td>
                      <td style={s.td}>
                        <div
                          style={{
                            display: 'flex',
                            gap: '0.35rem',
                            flexWrap: 'wrap',
                            maxWidth: '100%',
                          }}
                        >
                          {STATUS_OPTIONS.map(opt => (
                            <button
                              key={opt}
                              type="button"
                              onClick={() => onChangeStatus(st.id, opt)}
                              style={{
                                ...statusStyle(status === opt),
                                minWidth: 70,
                                minHeight: 40,
                                touchAction: 'manipulation',
                              }}
                              aria-pressed={status === opt}
                            >
                              {opt}
                            </button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div
            style={{
              ...s.flex,
              marginTop: '0.75rem',
              flexWrap: 'wrap',
              width: '100%',
            }}
          >
            <button type="button" style={s.btn} onClick={handleSave} disabled={saving || dirtyCount === 0}>
              {saving ? 'Saving…' : (dirtyCount > 0 ? `Save Attendance (${dirtyCount} changed)` : 'Attendance up to date')}
            </button>
            {dirtyCount === 0 && !saving && <span style={s.muted}>No unsaved changes for {date}.</span>}
          </div>
        </>
      )}
    </div>
  );
}