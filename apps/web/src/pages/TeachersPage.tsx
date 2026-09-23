import React, { useEffect, useState } from 'react';
import type { UserSummary } from '@school/shared';
import { usersApi } from '../api/users.js';
import { s } from '../styles/shared.js';

interface TeacherForm {
  id: number | null;
  username: string;
  displayName: string;
  password: string;
}

const EMPTY_FORM: TeacherForm = {
  id: null,
  username: '',
  displayName: '',
  password: '',
};

export function TeachersPage() {
  const [teachers, setTeachers] = useState<UserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<TeacherForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [actionBusy, setActionBusy] = useState<number | null>(null);

  async function loadTeachers() {
    setLoading(true);
    setError(null);

    const res = await usersApi.list();

    if (res.success && res.data) {
      setTeachers(res.data.filter(user => user.role === 'teacher'));
    } else {
      setError(res.error ?? 'Failed to load teachers');
    }

    setLoading(false);
  }

  useEffect(() => {
    void loadTeachers();
  }, []);

  function showNotice(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(null), 4000);
  }

  function openCreate() {
    setForm({ ...EMPTY_FORM });
    setError(null);
    setShowModal(true);
  }

  function openEdit(teacher: UserSummary) {
    setForm({
      id: teacher.id,
      username: teacher.username,
      displayName: teacher.displayName,
      password: '',
    });
    setError(null);
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const username = form.username.trim();
    const displayName = form.displayName.trim();
    const password = form.password;

    if (!username) {
      setError('Username is required');
      return;
    }

    if (!displayName) {
      setError('Teacher name is required');
      return;
    }

    if (form.id === null && password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    if (form.id !== null && password.length > 0 && password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setSaving(true);

    const res = form.id === null
      ? await usersApi.create({
          username,
          displayName,
          role: 'teacher',
          password,
        })
      : await usersApi.update(form.id, {
          displayName,
          ...(password ? { password } : {}),
        });

    setSaving(false);

    if (res.success) {
      setShowModal(false);
      showNotice(form.id === null ? 'Teacher added successfully' : 'Teacher updated successfully');
      void loadTeachers();
    } else {
      setError(res.error ?? 'Failed to save teacher');
    }
  }

  async function handleToggleActive(teacher: UserSummary) {
    const action = teacher.isActive ? 'Deactivate' : 'Activate';

    if (!window.confirm(`${action} teacher "${teacher.displayName}"?`)) {
      return;
    }

    setActionBusy(teacher.id);
    setError(null);

    const res = teacher.isActive
      ? await usersApi.deactivate(teacher.id)
      : await usersApi.update(teacher.id, { isActive: true });

    setActionBusy(null);

    if (res.success) {
      showNotice(
        `Teacher "${teacher.displayName}" ${teacher.isActive ? 'deactivated' : 'activated'}`
      );
      void loadTeachers();
    } else {
      setError(res.error ?? `Failed to ${action.toLowerCase()} teacher`);
    }
  }

  return (
    <div>
      <div style={s.between}>
        <div>
          <h1 style={s.pageTitle}>Teachers</h1>
          <p style={s.muted}>
            Add, edit and manage teacher accounts.
          </p>
        </div>

        <button type="button" style={s.btn} onClick={openCreate}>
          Add Teacher
        </button>
      </div>

      {error && <p style={s.errText} role="alert">{error}</p>}
      {notice && <p style={s.okText}>{notice}</p>}

      {loading ? (
        <p style={s.spinner}>Loading teachers…</p>
      ) : teachers.length === 0 ? (
        <div style={{ ...s.card, ...s.empty }}>
          No teachers found. Click "Add Teacher" to create the first teacher account.
        </div>
      ) : (
        <div style={s.tableWrap}>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>Username</th>
                <th style={s.th}>Teacher Name</th>
                <th style={s.th}>Status</th>
                <th style={s.th}>Actions</th>
              </tr>
            </thead>

            <tbody>
              {teachers.map(teacher => (
                <tr
                  key={teacher.id}
                  style={{ opacity: teacher.isActive ? 1 : 0.55 }}
                >
                  <td style={s.td}>{teacher.username}</td>

                  <td style={s.td}>{teacher.displayName}</td>

                  <td style={s.td}>
                    <span
                      style={
                        teacher.isActive
                          ? s.badgeGreen
                          : s.badgeGrey
                      }
                    >
                      {teacher.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>

                  <td style={s.td}>
                    <span style={s.actions}>
                      <button
                        type="button"
                        style={{ ...s.btnSecondary, ...s.btnSmall }}
                        onClick={() => openEdit(teacher)}
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        style={
                          teacher.isActive
                            ? { ...s.btnDanger, ...s.btnSmall }
                            : { ...s.btnSecondary, ...s.btnSmall }
                        }
                        onClick={() => handleToggleActive(teacher)}
                        disabled={actionBusy === teacher.id}
                      >
                        {actionBusy === teacher.id
                          ? '…'
                          : teacher.isActive
                            ? 'Deactivate'
                            : 'Activate'}
                      </button>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div
          style={s.modal}
          onClick={() => setShowModal(false)}
        >
          <div
            style={s.modalCard}
            onClick={e => e.stopPropagation()}
          >
            <h2 style={s.modalTitle}>
              {form.id === null ? 'Add Teacher' : 'Edit Teacher'}
            </h2>

            <form
              onSubmit={handleSubmit}
              noValidate
              style={s.form}
            >
              <div style={s.field}>
                <label style={s.label} htmlFor="teacherUsername">
                  Username *
                </label>

                <input
                  id="teacherUsername"
                  style={s.input}
                  value={form.username}
                  onChange={e =>
                    setForm({
                      ...form,
                      username: e.target.value,
                    })
                  }
                  disabled={form.id !== null || saving}
                  required
                />

                {form.id !== null && (
                  <small style={s.muted}>
                    Username cannot be changed after account creation.
                  </small>
                )}
              </div>

              <div style={s.field}>
                <label style={s.label} htmlFor="teacherName">
                  Teacher name *
                </label>

                <input
                  id="teacherName"
                  style={s.input}
                  value={form.displayName}
                  onChange={e =>
                    setForm({
                      ...form,
                      displayName: e.target.value,
                    })
                  }
                  disabled={saving}
                  required
                />
              </div>

              <div style={s.field}>
                <label style={s.label} htmlFor="teacherPassword">
                  {form.id === null
                    ? 'Password *'
                    : 'New password (optional)'}
                </label>

                <input
                  id="teacherPassword"
                  type="password"
                  style={s.input}
                  value={form.password}
                  onChange={e =>
                    setForm({
                      ...form,
                      password: e.target.value,
                    })
                  }
                  placeholder={
                    form.id === null
                      ? 'Minimum 6 characters'
                      : 'Leave blank to keep current password'
                  }
                  disabled={saving}
                  required={form.id === null}
                />
              </div>

              {error && (
                <p style={s.errText} role="alert">
                  {error}
                </p>
              )}

              <div style={s.modalActions}>
                <button
                  type="button"
                  style={s.btnSecondary}
                  onClick={() => setShowModal(false)}
                  disabled={saving}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  style={s.btn}
                  disabled={saving}
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}