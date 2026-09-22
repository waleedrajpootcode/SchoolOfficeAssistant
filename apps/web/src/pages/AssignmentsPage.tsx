import React, { useEffect, useMemo, useState } from 'react';
import type { ClassSummary, TeacherClassAssignment, UserSummary } from '@school/shared';
import { classesApi } from '../api/classes.js';
import { teacherClassesApi } from '../api/teacherClasses.js';
import { usersApi } from '../api/users.js';
import { s } from '../styles/shared.js';

export function AssignmentsPage() {
  const [teachers, setTeachers] = useState<UserSummary[]>([]);
  const [classes, setClasses] = useState<ClassSummary[]>([]);
  const [assignments, setAssignments] = useState<TeacherClassAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [teacherId, setTeacherId] = useState<number | ''>('');
  const [classId, setClassId] = useState<number | ''>('');

  const teacherOptions = useMemo(() => teachers.filter(t => t.role === 'teacher' && t.isActive), [teachers]);
  const activeClasses = useMemo(() => classes.filter(c => c.isActive), [classes]);

  async function load() {
    setLoading(true);
    setError(null);
    const [asg, tcs, cls] = await Promise.all([
      teacherClassesApi.list(),
      usersApi.list(),
      classesApi.list(),
    ]);
    if (asg.success && asg.data) setAssignments(asg.data);
    else setError(asg.error ?? 'Failed to load assignments');
    if (tcs.success && tcs.data) setTeachers(tcs.data);
    if (cls.success && cls.data) setClasses(cls.data);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function showNotice(msg: string) {
    setNotice(msg);
    window.setTimeout(() => setNotice(null), 4000);
  }

  async function handleAssign(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (teacherId === '' || classId === '') { setError('Select both a teacher and a class'); return; }
    setSaving(true);
    const res = await teacherClassesApi.create({ teacherId: teacherId as number, classId: classId as number });
    setSaving(false);
    if (res.success) {
      showNotice('Assignment created');
      setClassId('');
      load();
    } else {
      setError(res.error ?? 'Failed to create assignment');
    }
  }

  async function handleRemove(a: TeacherClassAssignment) {
    if (!window.confirm(`Remove ${a.teacherName} from "${a.className}"?`)) return;
    const key = `${a.teacherId}:${a.classId}`;
    setRemoving(key);
    setError(null);
    const res = await teacherClassesApi.remove(a.teacherId, a.classId);
    setRemoving(null);
    if (res.success) {
      showNotice('Assignment removed');
      load();
    } else {
      setError(res.error ?? 'Failed to remove assignment');
    }
  }

  return (
    <div>
      <h1 style={s.pageTitle}>Teacher Assignments</h1>
      <p style={s.muted}>Assign teachers to classes or remove existing assignments.</p>

      {/* ── Assign form ── */}
      <div style={s.card}>
        <h2 style={s.formTitle}>New Assignment</h2>
        <form onSubmit={handleAssign} noValidate>
          <div style={s.row}>
            <div style={{ ...s.field, flex: '1 1 200px' }}>
              <label style={s.label} htmlFor="teacher">Teacher *</label>
              <select id="teacher" style={s.select} value={teacherId}
                onChange={e => setTeacherId(e.target.value === '' ? '' : Number(e.target.value))} required>
                <option value="">Select teacher…</option>
                {teacherOptions.map(t => (
                  <option key={t.id} value={t.id}>{t.displayName} ({t.username})</option>
                ))}
              </select>
            </div>
            <div style={{ ...s.field, flex: '1 1 200px' }}>
              <label style={s.label} htmlFor="aclass">Class *</label>
              <select id="aclass" style={s.select} value={classId}
                onChange={e => setClassId(e.target.value === '' ? '' : Number(e.target.value))} required>
                <option value="">Select class…</option>
                {activeClasses.map(c => (
                  <option key={c.id} value={c.id}>{c.name}{c.section ? ` · ${c.section}` : ''}</option>
                ))}
              </select>
            </div>
            <button type="submit" style={s.btn} disabled={saving || teacherId === '' || classId === ''}>
              {saving ? 'Assigning…' : 'Assign'}
            </button>
          </div>
          {error && <p style={s.errText} role="alert">{error}</p>}
        </form>
      </div>

      {error && <p style={s.errText} role="alert">{error}</p>}
      {notice && <p style={s.okText}>{notice}</p>}

      {loading ? (
        <p style={s.spinner}>Loading assignments…</p>
      ) : assignments.length === 0 ? (
        <div style={{ ...s.card, ...s.empty }}>
          No assignments yet. Use the form above to assign a teacher to a class.
        </div>
      ) : (
        <div style={s.tableWrap}>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>Teacher</th>
                <th style={s.th}>Class</th>
                <th style={s.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {assignments.map(a => {
                const key = `${a.teacherId}:${a.classId}`;
                return (
                  <tr key={key}>
                    <td style={s.td}>{a.teacherName}</td>
                    <td style={s.td}>{a.className}</td>
                    <td style={s.td}>
                      <button
                        style={{ ...s.btnDanger, ...s.btnSmall }}
                        onClick={() => handleRemove(a)}
                        disabled={removing === key}
                      >
                        {removing === key ? 'Removing…' : 'Remove'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}