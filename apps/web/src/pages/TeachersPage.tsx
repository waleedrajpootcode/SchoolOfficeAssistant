import React, { useEffect, useState } from 'react';
import type { UserSummary, TeacherProfile } from '@school/shared';
import { usersApi } from '../api/users.js';
import { teacherProfilesApi } from '../api/teacherProfiles.js';
import { s } from '../styles/shared.js';

interface TeacherForm {
  id: number | null;
  username: string;
  displayName: string;
  password: string;
  phone: string;
  email: string;
  subject: string;
  joiningDate: string;
  monthlySalary: string;
  notes: string;
}

const EMPTY_FORM: TeacherForm = {
  id: null,
  username: '',
  displayName: '',
  password: '',
  phone: '',
  email: '',
  subject: '',
  joiningDate: '',
  monthlySalary: '',
  notes: '',
};

export function TeachersPage() {
  const [teachers, setTeachers] = useState<UserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<TeacherForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
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

  async function openEdit(teacher: UserSummary) {
    setForm({
      ...EMPTY_FORM,
      id: teacher.id,
      username: teacher.username,
      displayName: teacher.displayName,
    });
    setError(null);
    setShowModal(true);
    setProfileLoading(true);

    const res = await teacherProfilesApi.get(teacher.id);

    setProfileLoading(false);

    if (res.success && res.data) {
      const profile: TeacherProfile = res.data;

      setForm(current => ({
        ...current,
        phone: profile.phone ?? '',
        email: profile.email ?? '',
        subject: profile.subject ?? '',
        joiningDate: profile.joiningDate ?? '',
        monthlySalary:
          profile.monthlySalary > 0
            ? String(profile.monthlySalary)
            : '',
        notes: profile.notes ?? '',
      }));
    } else if (res.error && !res.error.toLowerCase().includes('not found')) {
      setError(res.error);
    }
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

    const salaryText = form.monthlySalary.trim();
    const monthlySalary = salaryText === '' ? 0 : Number(salaryText);

    if (!Number.isInteger(monthlySalary) || monthlySalary < 0) {
      setError('Monthly salary must be a valid non-negative amount');
      return;
    }

    setSaving(true);

    try {
      let teacherId = form.id;

      if (teacherId === null) {
        const res = await usersApi.create({
          username,
          displayName,
          role: 'teacher',
          password,
        });

        if (!res.success || !res.data) {
          setError(res.error ?? 'Failed to create teacher account');
          return;
        }

        teacherId = res.data.id;
      } else {
        const res = await usersApi.update(teacherId, {
          displayName,
          ...(password ? { password } : {}),
        });

        if (!res.success) {
          setError(res.error ?? 'Failed to update teacher account');
          return;
        }
      }

      const profileBody = {
        phone: form.phone.trim(),
        email: form.email.trim(),
        subject: form.subject.trim(),
        joiningDate: form.joiningDate || undefined,
        monthlySalary,
        notes: form.notes.trim(),
      };

      const profileRes = form.id === null
        ? await teacherProfilesApi.create(teacherId, profileBody)
        : await teacherProfilesApi.update(teacherId, profileBody);

      if (!profileRes.success) {
        setError(
          profileRes.error ??
          'Teacher account saved, but profile could not be saved'
        );
        return;
      }

      setShowModal(false);
      showNotice(
        form.id === null
          ? 'Teacher added successfully'
          : 'Teacher updated successfully'
      );
      void loadTeachers();
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(teacher: UserSummary) {
    const action = teacher.isActive ? 'Delete' : 'Activate';

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
        `Teacher "${teacher.displayName}" ${
          teacher.isActive ? 'deactivated' : 'activated'
        }`
      );
      void loadTeachers();
    } else {
      setError(res.error ?? `Failed to ${action.toLowerCase()} teacher`);
    }
  }

  function updateField(
    field: keyof TeacherForm,
    value: string
  ) {
    setForm(current => ({
      ...current,
      [field]: value,
    }));
  }

  return (
    <div style={{ animation: 'soaTeachersPageIn 240ms ease-out' }}>
      <style>{`
        @keyframes soaTeachersPageIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .soa-teacher-select:focus,
        .soa-teacher-input:focus {
          outline: none;
          border-color: #1677C8 !important;
          box-shadow: 0 0 0 3px rgba(22,119,200,0.12) !important;
        }
      `}</style>
      <div
        style={{
          ...s.between,
          marginBottom: 18,
          alignItems: 'center',
          gap: 16,
        }}
      >
        <div>
          <h1 style={{ ...s.pageTitle, marginBottom: 5 }}>Teachers</h1>
          <p style={s.muted}>
            Manage teacher accounts, profiles and monthly salary details.
          </p>
        </div>

        <button
          type="button"
          style={{
            ...s.btn,
            background: 'linear-gradient(135deg, #123B5D 0%, #1677C8 68%, #38BDF8 100%)',
            borderColor: 'rgba(18,59,93,0.18)',
            boxShadow: '0 9px 20px rgba(18,59,93,0.20)',
            transition: 'transform 160ms ease, box-shadow 160ms ease',
          }}
          onClick={openCreate}
          onMouseEnter={e => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 12px 24px rgba(18,59,93,0.24)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform = '';
            e.currentTarget.style.boxShadow = '0 9px 20px rgba(18,59,93,0.20)';
          }}
        >
          + Add Teacher
        </button>
      </div>

      {error && <p style={s.errText} role="alert">{error}</p>}
      {notice && <p style={s.okText}>{notice}</p>}

      {loading ? (
        <p style={s.spinner}>Loading teachers...</p>
      ) : teachers.length === 0 ? (
        <div style={{ ...s.card, ...s.empty }}>
          No teachers found. Click "Add Teacher" to create the first teacher.
        </div>
      ) : (
        <div
          style={{
            ...s.tableWrap,
            marginTop: 4,
            borderRadius: 16,
            border: `1px solid ${s.border}`,
            boxShadow: '0 10px 28px rgba(18,59,93,0.07)',
            background: '#ffffff',
            overflow: 'hidden',
          }}
        >
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
                  style={{
                    opacity: teacher.isActive ? 1 : 0.58,
                    transition: 'background 160ms ease',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background =
                      'linear-gradient(90deg, rgba(239,246,255,0.72), rgba(248,250,252,0.55))';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = '';
                  }}
                >
                  <td style={s.td}>{teacher.username}</td>
                  <td style={s.td}>{teacher.displayName}</td>

                  <td style={s.td}>
                    <span
                      style={{
                        ...(teacher.isActive ? s.badgeGreen : s.badgeGrey),
                        borderRadius: 999,
                        padding: '5px 10px',
                        fontSize: 12,
                        fontWeight: 750,
                        letterSpacing: 0.15,
                        boxShadow: teacher.isActive
                          ? '0 3px 9px rgba(21,128,61,0.12)'
                          : '0 3px 9px rgba(100,116,139,0.10)',
                      }}
                    >
                      {teacher.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>

                  <td style={s.td}>
                    <span
                      style={{
                        ...s.actions,
                        gap: 7,
                        flexWrap: 'wrap',
                      }}
                    >
                      <button
                        type="button"
                        style={{
                          ...s.btnSecondary,
                          ...s.btnSmall,
                          borderRadius: 9,
                          fontWeight: 700,
                          transition: 'transform 160ms ease, box-shadow 160ms ease',
                        }}
                        onClick={() => void openEdit(teacher)}
                        onMouseEnter={e => {
                          e.currentTarget.style.transform = 'translateY(-1px)';
                          e.currentTarget.style.boxShadow = '0 5px 12px rgba(15,23,42,0.10)';
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.transform = '';
                          e.currentTarget.style.boxShadow = '';
                        }}
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        style={{
                          ...(teacher.isActive
                            ? { ...s.btnDanger, ...s.btnSmall }
                            : { ...s.btnSecondary, ...s.btnSmall }),
                          borderRadius: 9,
                          fontWeight: 700,
                          transition: 'transform 160ms ease, box-shadow 160ms ease',
                        }}
                        onClick={() => void handleToggleActive(teacher)}
                        disabled={actionBusy === teacher.id}
                        onMouseEnter={e => {
                          if (!e.currentTarget.disabled) {
                            e.currentTarget.style.transform = 'translateY(-1px)';
                            e.currentTarget.style.boxShadow = teacher.isActive
                              ? '0 5px 12px rgba(220,38,38,0.16)'
                              : '0 5px 12px rgba(15,23,42,0.10)';
                          }
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.transform = '';
                          e.currentTarget.style.boxShadow = '';
                        }}
                      >
                        {actionBusy === teacher.id
                          ? '...'
                          : teacher.isActive
                            ? 'Delete'
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
          onClick={() => {
            if (!saving) setShowModal(false);
          }}
        >
          <div
            style={{
              ...s.modalCard,
              maxWidth: 720,
              maxHeight: '90vh',
              overflowY: 'auto',
              borderRadius: 18,
              border: `1px solid ${s.border}`,
              boxShadow: '0 24px 70px rgba(15,23,42,0.20)',
              background: 'linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <h2
              style={{
                ...s.modalTitle,
                marginBottom: 18,
                letterSpacing: -0.2,
              }}
            >
              {form.id === null ? 'Add Teacher' : 'Edit Teacher'}
            </h2>

            {profileLoading ? (
              <p style={s.spinner}>Loading teacher profile...</p>
            ) : (
              <form
                onSubmit={handleSubmit}
                noValidate
                style={{
                  ...s.form,
                  gap: 14,
                }}
              >
                <div style={s.field}>
                  <label style={s.label} htmlFor="teacherUsername">
                    Username *
                  </label>
                  <input
                    id="teacherUsername"
                    className="soa-teacher-input"
                    style={s.input}
                    value={form.username}
                    onChange={e =>
                      updateField('username', e.target.value)
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
                    className="soa-teacher-input"
                    style={s.input}
                    value={form.displayName}
                    onChange={e =>
                      updateField('displayName', e.target.value)
                    }
                    disabled={saving}
                    required
                  />
                </div>

                <div style={s.field}>
                  <label style={s.label} htmlFor="teacherPhone">
                    Phone
                  </label>
                  <input
                    id="teacherPhone"
                    className="soa-teacher-input"
                    type="tel"
                    style={s.input}
                    value={form.phone}
                    onChange={e =>
                      updateField('phone', e.target.value)
                    }
                    placeholder="03XXXXXXXXX"
                    disabled={saving}
                  />
                </div>

                <div style={s.field}>
                  <label style={s.label} htmlFor="teacherEmail">
                    Email
                  </label>
                  <input
                    id="teacherEmail"
                    className="soa-teacher-input"
                    type="email"
                    style={s.input}
                    value={form.email}
                    onChange={e =>
                      updateField('email', e.target.value)
                    }
                    placeholder="teacher@example.com"
                    disabled={saving}
                  />
                </div>

                <div style={s.field}>
                  <label style={s.label} htmlFor="teacherSubject">
                    Subject
                  </label>
                  <input
                    id="teacherSubject"
                    className="soa-teacher-input"
                    style={s.input}
                    value={form.subject}
                    onChange={e =>
                      updateField('subject', e.target.value)
                    }
                    placeholder="Mathematics"
                    disabled={saving}
                  />
                </div>

                <div style={s.field}>
                  <label style={s.label} htmlFor="teacherJoiningDate">
                    Joining date
                  </label>
                  <input
                    id="teacherJoiningDate"
                    className="soa-teacher-input"
                    type="date"
                    style={s.input}
                    value={form.joiningDate}
                    onChange={e =>
                      updateField('joiningDate', e.target.value)
                    }
                    disabled={saving}
                  />
                </div>

                <div style={s.field}>
                  <label style={s.label} htmlFor="teacherSalary">
                    Monthly salary
                  </label>
                  <input
                    id="teacherSalary"
                    className="soa-teacher-input"
                     type="number"
                    min="0"
                    step="1"
                    style={s.input}
                    value={form.monthlySalary}
                    onChange={e =>
                      updateField('monthlySalary', e.target.value)
                    }
                    placeholder="25000"
                    disabled={saving}
                  />
                  <small style={s.muted}>
                    This becomes the default salary for the teacher.
                  </small>
                </div>

                <div style={s.field}>
                  <label style={s.label} htmlFor="teacherNotes">
                    Notes
                  </label>
                  <textarea
                    id="teacherNotes"
                    className="soa-teacher-input"
                     style={{
                      ...s.input,
                      minHeight: 90,
                      resize: 'vertical',
                    }}
                    value={form.notes}
                    onChange={e =>
                      updateField('notes', e.target.value)
                    }
                    placeholder="Optional notes"
                    disabled={saving}
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
                    className="soa-teacher-input"
                     type="password"
                    style={s.input}
                    value={form.password}
                    onChange={e =>
                      updateField('password', e.target.value)
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

                <div
                   style={{
                     ...s.modalActions,
                     marginTop: 4,
                     gap: 9,
                   }}
                 >
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
                    disabled={saving || profileLoading}
                  >
                    {saving ? 'Saving...' : 'Save Teacher'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}


