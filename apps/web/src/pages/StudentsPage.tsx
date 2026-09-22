import React, { useEffect, useState } from 'react';
import type { ClassSummary, StudentSummary } from '@school/shared';
import { classesApi } from '../api/classes.js';
import { studentsApi } from '../api/students.js';
import { s } from '../styles/shared.js';

interface StudentForm {
  id: number | null;
  rollNumber: string;
  fullName: string;
  guardianName: string;
  guardianPhone: string;
  classId: number | '';
}

const EMPTY_FORM: StudentForm = {
  id: null,
  rollNumber: '',
  fullName: '',
  guardianName: '',
  guardianPhone: '',
  classId: '',
};

export function StudentsPage() {
  const [students, setStudents] = useState<StudentSummary[]>([]);
  const [classes, setClasses] = useState<ClassSummary[]>([]);
  const [filterClass, setFilterClass] = useState<number | ''>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<StudentForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [actionBusy, setActionBusy] = useState<number | null>(null);

  async function loadClasses() {
    const res = await classesApi.list();
    if (res.success && res.data) setClasses(res.data);
  }

  async function loadStudents() {
    setLoading(true);
    setError(null);
    const res = await studentsApi.list(filterClass === '' ? undefined : filterClass);
    if (res.success && res.data) setStudents(res.data);
    else setError(res.error ?? 'Failed to load students');
    setLoading(false);
  }

  useEffect(() => { loadClasses(); }, []);

  useEffect(() => { loadStudents(); }, [filterClass]);

  function showNotice(msg: string) {
    setNotice(msg);
    window.setTimeout(() => setNotice(null), 4000);
  }

  function openCreate() {
    setForm({ ...EMPTY_FORM, classId: filterClass === '' ? (classes[0]?.id ?? '') : filterClass });
    setShowModal(true);
  }

  function openEdit(st: StudentSummary) {
    setForm({
      id: st.id,
      rollNumber: st.rollNumber,
      fullName: st.fullName,
      guardianName: st.guardianName,
      guardianPhone: st.guardianPhone ?? '',
      classId: st.classId,
    });
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.rollNumber.trim()) { setError('Roll number is required'); return; }
    if (!form.fullName.trim()) { setError('Student name is required'); return; }
    if (!form.guardianName.trim()) { setError('Guardian name is required'); return; }
    if (form.classId === '') { setError('Select a class'); return; }

    setSaving(true);
    const payload = {
      rollNumber: form.rollNumber.trim(),
      fullName: form.fullName.trim(),
      guardianName: form.guardianName.trim(),
      guardianPhone: form.guardianPhone.trim() || undefined,
      classId: form.classId as number,
    };

    const res = form.id === null
      ? await studentsApi.create(payload)
      : await studentsApi.update(form.id, payload);
    setSaving(false);

    if (res.success) {
      setShowModal(false);
      showNotice(form.id === null ? 'Student added' : 'Student updated');
      loadStudents();
    } else {
      setError(res.error ?? 'Failed to save student');
    }
  }

  async function handleToggleActive(st: StudentSummary) {
    if (!window.confirm(`${st.isActive ? 'Deactivate' : 'Activate'} student "${st.fullName}"?`)) return;
    setActionBusy(st.id);
    setError(null);
    const res = st.isActive ? await studentsApi.deactivate(st.id) : await studentsApi.update(st.id, { isActive: true });
    setActionBusy(null);
    if (res.success) showNotice(`Student "${st.fullName}" ${st.isActive ? 'deactivated' : 'activated'}`);
    else setError(res.error ?? 'Failed to update student');
    loadStudents();
  }

  const activeClasses = classes.filter(c => c.isActive);

  return (
    <div>
      <div style={s.between}>
        <div>
          <h1 style={s.pageTitle}>Students</h1>
          <p style={s.muted}>Add, edit and manage student records.</p>
        </div>
        <button type="button" style={s.btn} onClick={openCreate}>Add Student</button>
      </div>

      {/* ── Filter ── */}
      <div style={{ ...s.card, ...s.flex }}>
        <div style={{ ...s.field, maxWidth: 260 }}>
          <label style={s.label} htmlFor="classFilter">Filter by class</label>
          <select
            id="classFilter" style={s.select}
            value={filterClass} onChange={e => setFilterClass(e.target.value === '' ? '' : Number(e.target.value))}
          >
            <option value="">All classes</option>
            {classes.map(c => (
              <option key={c.id} value={c.id}>{c.name}{c.section ? ` · ${c.section}` : ''}</option>
            ))}
          </select>
        </div>
      </div>

      {error && <p style={s.errText} role="alert">{error}</p>}
      {notice && <p style={s.okText}>{notice}</p>}

      {loading ? (
        <p style={s.spinner}>Loading students…</p>
      ) : students.length === 0 ? (
        <div style={{ ...s.card, ...s.empty }}>
          No students found. Click "Add Student" to add one.
        </div>
      ) : (
        <div style={s.tableWrap}>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>Roll No</th>
                <th style={s.th}>Name</th>
                <th style={s.th}>Guardian</th>
                <th style={s.th}>Phone</th>
                <th style={s.th}>Class</th>
                <th style={s.th}>Status</th>
                <th style={s.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {students.map(st => (
                <tr key={st.id} style={{ opacity: st.isActive ? 1 : 0.55 }}>
                  <td style={s.td}>{st.rollNumber}</td>
                  <td style={s.td}>{st.fullName}</td>
                  <td style={s.td}>{st.guardianName}</td>
                  <td style={s.td}>{st.guardianPhone || '—'}</td>
                  <td style={s.td}>{st.className}</td>
                  <td style={s.td}>
                    <span style={st.isActive ? s.badgeGreen : s.badgeGrey}>
                      {st.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={s.td}>
                    <span style={s.actions}>
                      <button style={{ ...s.btnSecondary, ...s.btnSmall }} onClick={() => openEdit(st)}>Edit</button>
                      <button
                        style={st.isActive ? {...s.btnDanger, ...s.btnSmall} : {...s.btnSecondary, ...s.btnSmall}}
                        onClick={() => handleToggleActive(st)}
                        disabled={actionBusy === st.id}
                      >
                        {actionBusy === st.id ? '…' : (st.isActive ? 'Deactivate' : 'Activate')}
                      </button>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Add / Edit modal ── */}
      {showModal && (
        <div style={s.modal} onClick={() => setShowModal(false)}>
          <div style={s.modalCard} onClick={e => e.stopPropagation()}>
            <h2 style={s.modalTitle}>{form.id === null ? 'Add Student' : 'Edit Student'}</h2>
            <form onSubmit={handleSubmit} noValidate style={s.form}>
              <div style={s.row}>
                <div style={{ ...s.field, flex: '1 1 140px' }}>
                  <label style={s.label} htmlFor="roll">Roll / Admission No *</label>
                  <input id="roll" style={s.input} value={form.rollNumber}
                    onChange={e => setForm({ ...form, rollNumber: e.target.value })} required />
                </div>
                <div style={{ ...s.field, flex: '2 1 200px' }}>
                  <label style={s.label} htmlFor="sname">Student name *</label>
                  <input id="sname" style={s.input} value={form.fullName}
                    onChange={e => setForm({ ...form, fullName: e.target.value })} required />
                </div>
              </div>
              <div style={s.row}>
                <div style={{ ...s.field, flex: '2 1 200px' }}>
                  <label style={s.label} htmlFor="guardian">Guardian name *</label>
                  <input id="guardian" style={s.input} value={form.guardianName}
                    onChange={e => setForm({ ...form, guardianName: e.target.value })} required />
                </div>
                <div style={{ ...s.field, flex: '1 1 140px' }}>
                  <label style={s.label} htmlFor="phone">Guardian phone</label>
                  <input id="phone" style={s.input} value={form.guardianPhone}
                    onChange={e => setForm({ ...form, guardianPhone: e.target.value })} />
                </div>
              </div>
              <div style={s.field}>
                <label style={s.label} htmlFor="sclass">Class *</label>
                <select id="sclass" style={s.select} value={form.classId}
                  onChange={e => setForm({ ...form, classId: e.target.value === '' ? '' : Number(e.target.value) })} required>
                  <option value="">Select class…</option>
                  {activeClasses.map(c => (
                    <option key={c.id} value={c.id}>{c.name}{c.section ? ` · ${c.section}` : ''}</option>
                  ))}
                </select>
              </div>
              {error && <p style={s.errText} role="alert">{error}</p>}
              <div style={s.modalActions}>
                <button type="button" style={s.btnSecondary} onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" style={s.btn} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}