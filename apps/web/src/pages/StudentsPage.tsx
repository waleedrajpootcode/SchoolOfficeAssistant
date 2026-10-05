import React, { useEffect, useState } from 'react';
import type { ClassSummary, StudentSummary, FeeStructure } from '@school/shared';
import { classesApi } from '../api/classes.js';
import { studentsApi } from '../api/students.js';
import { feesApi } from '../api/fees.js';
import { studentFeeAssignmentsApi } from '../api/studentFeeAssignments.js';
import { s } from '../styles/shared.js';

interface StudentForm {
  id: number | null;
  rollNumber: string;
  fullName: string;
  guardianName: string;
  guardianPhone: string;
  classId: number | '';
  feeStructureId: number | '';
  monthlyFee: string;
  feeEffectiveFrom: string;
}

const EMPTY_FORM: StudentForm = {
  id: null,
  rollNumber: '',
  fullName: '',
  guardianName: '',
  guardianPhone: '',
  classId: '',
  feeStructureId: '',
  monthlyFee: '',
  feeEffectiveFrom: new Date().toISOString().slice(0, 7) + '-01',
};

export function StudentsPage() {
  const [students, setStudents] = useState<StudentSummary[]>([]);
  const [classes, setClasses] = useState<ClassSummary[]>([]);
  const [feeStructures, setFeeStructures] = useState<FeeStructure[]>([]);
  const [filterClass, setFilterClass] = useState<number | ''>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<StudentForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [actionBusy, setActionBusy] = useState<number | null>(null);
  const [messageStudent, setMessageStudent] = useState<StudentSummary | null>(null);
  const [messageType, setMessageType] = useState<"fee" | "attendance" | "general" | "custom">("fee");
  const [customMessage, setCustomMessage] = useState("");


  async function loadClasses() {
    const [classRes, feeRes] = await Promise.all([
      classesApi.list(),
      feesApi.listStructures(),
    ]);

    if (classRes.success && classRes.data) setClasses(classRes.data);
    if (feeRes.success && feeRes.data) setFeeStructures(feeRes.data);
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
    const classId = filterClass === '' ? (classes[0]?.id ?? '') : filterClass;
    const firstStructure = feeStructures.find(
      fs => fs.isActive && fs.classId === classId
    );

    setForm({
      ...EMPTY_FORM,
      classId,
      feeStructureId: firstStructure?.id ?? '',
      monthlyFee: firstStructure ? String(firstStructure.amount) : '',
    });
    setShowModal(true);
  }

  async function openEdit(st: StudentSummary) {
    const assignmentRes = await studentFeeAssignmentsApi.list({
      studentId: st.id,
      activeOnly: true,
    });

    const assignment = assignmentRes.success
      ? assignmentRes.data?.[0]
      : undefined;

    setForm({
      id: st.id,
      rollNumber: st.rollNumber,
      fullName: st.fullName,
      guardianName: st.guardianName,
      guardianPhone: st.guardianPhone ?? '',
      classId: st.classId,
      feeStructureId: assignment?.feeStructureId ?? '',
      monthlyFee: assignment
        ? String(assignment.amount)
        : '',
      feeEffectiveFrom:
        assignment?.effectiveFrom ??
        new Date().toISOString().slice(0, 7) + '-01',
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

    if (form.feeStructureId === '') {
      setError('Select a fee type');
      return;
    }

    const monthlyFee = Number(form.monthlyFee);
      if (!Number.isFinite(monthlyFee) || monthlyFee < 0 || !Number.isInteger(monthlyFee)) {
        setError('Enter a valid monthly fee amount');
        return;
      }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.feeEffectiveFrom)) {
      setError('Enter a valid effective date');
      return;
    }

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

    if (!res.success || !res.data) {
      setSaving(false);
      setError(res.error ?? 'Failed to save student');
      return;
    }

    if (form.id === null) {
      const assignmentRes = await studentFeeAssignmentsApi.create({
        studentId: res.data.id,
        feeStructureId: form.feeStructureId as number,
        amount: Number(form.monthlyFee),
        effectiveFrom: form.feeEffectiveFrom,
      });

      if (!assignmentRes.success) {
        setSaving(false);
        setError(
          `Student was added, but fee setup failed: ${assignmentRes.error ?? 'Unknown error'}.`
        );
        loadStudents();
        return;
      }
    } else {
      const assignmentRes = await studentFeeAssignmentsApi.list({
        studentId: form.id,
        activeOnly: true,
      });

      const existingAssignment = assignmentRes.success
        ? assignmentRes.data?.[0]
        : undefined;

      if (existingAssignment) {
        const updateRes = await studentFeeAssignmentsApi.update(
          existingAssignment.id,
          {
            feeStructureId: form.feeStructureId as number,
            amount: Number(form.monthlyFee),
            effectiveFrom: form.feeEffectiveFrom,
          }
        );

        if (!updateRes.success) {
          setSaving(false);
          setError(
            `Student updated, but fee plan update failed: ${updateRes.error ?? 'Unknown error'}.`
          );
          loadStudents();
          return;
        }
      } else {
        const createAssignmentRes =
          await studentFeeAssignmentsApi.create({
            studentId: form.id,
            feeStructureId: form.feeStructureId as number,
            amount: Number(form.monthlyFee),
            effectiveFrom: form.feeEffectiveFrom,
          });

        if (!createAssignmentRes.success) {
          setSaving(false);
          setError(
            `Student updated, but fee plan setup failed: ${createAssignmentRes.error ?? 'Unknown error'}.`
          );
          loadStudents();
          return;
        }
      }
    }

    setSaving(false);
    setShowModal(false);
    showNotice(
      form.id === null
        ? 'Student added with recurring fee setup'
        : 'Student updated'
    );
    loadStudents();
  }

  async function handleToggleActive(st: StudentSummary) {
    if (!window.confirm(`${st.isActive ? 'Delete' : 'Activate'} student "${st.fullName}"?`)) return;
    setActionBusy(st.id);
    setError(null);
    const res = st.isActive ? await studentsApi.deactivate(st.id) : await studentsApi.update(st.id, { isActive: true });
    setActionBusy(null);
    if (res.success) showNotice(`Student "${st.fullName}" ${st.isActive ? 'deactivated' : 'activated'}`);
    else setError(res.error ?? 'Failed to update student');
    loadStudents();
  }

  function buildParentMessage(st: StudentSummary) {
    const name = st.fullName;
    const guardian = st.guardianName || "Parent/Guardian";

    if (messageType === "fee") {
      return `Dear ${guardian}, this is a reminder regarding ${name}'s school fee. Please contact the school office if you need any information.`;
    }

    if (messageType === "attendance") {
      return `Dear ${guardian}, ${name} was marked absent today. Please contact the school office if this was unexpected.`;
    }

    if (messageType === "general") {
      return `Dear ${guardian}, this is a message from the school office regarding ${name}. Please contact the school office for further information.`;
    }

    return customMessage.trim();
  }

  function openParentMessage(st: StudentSummary) {
    if (!st.guardianPhone?.trim()) {
      setError(`No guardian phone number is saved for ${st.fullName}.`);
      return;
    }

    setError(null);
    setNotice(null);
    setMessageStudent(st);
    setMessageType("fee");
    setCustomMessage("");
  }

  function sendParentWhatsApp() {
    if (!messageStudent?.guardianPhone?.trim()) return;

    const message = buildParentMessage(messageStudent);

    if (!message) {
      setError("Message cannot be empty.");
      return;
    }

    let phone = messageStudent.guardianPhone.replace(/\D/g, "");

    if (phone.startsWith("00")) {
      phone = phone.slice(2);
    }

    if (phone.startsWith("0")) {
      phone = "92" + phone.slice(1);
    }

    if (!phone) {
      setError("Invalid guardian phone number.");
      return;
    }

    window.open(
      `https://wa.me/${phone}?text=${encodeURIComponent(message)}`,
      "_blank",
      "noopener,noreferrer"
    );

    setMessageStudent(null);
  }

  const activeClasses = classes.filter(c => c.isActive);

  return (
    <div style={{ animation: 'soaStudentsPageIn 240ms ease-out' }}>
      <style>{`
        @keyframes soaStudentsPageIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
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
          <h1 style={{ ...s.pageTitle, marginBottom: 5 }}>Students</h1>
          <p style={{ ...s.muted, margin: 0 }}>Add, edit and manage student records.</p>
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
        >
          + Add Student
        </button>
      </div>

      {/* â”€â”€ Filter â”€â”€ */}
      <div style={{ ...s.card, ...s.flex }}>
        <div style={{ ...s.field, maxWidth: 260 }}>
          <label style={s.label} htmlFor="classFilter">Filter by class</label>
          <select
            id="classFilter" style={s.select}
            value={filterClass} onChange={e => setFilterClass(e.target.value === '' ? '' : Number(e.target.value))}
          >
            <option value="">All classes</option>
            {classes.map(c => (
              <option key={c.id} value={c.id}>{c.name}{c.section ? ` Â· ${c.section}` : ''}</option>
            ))}
          </select>
        </div>
      </div>

      {error && <p style={s.errText} role="alert">{error}</p>}
      {notice && <p style={s.okText}>{notice}</p>}

      {loading ? (
        <p style={s.spinner}>Loading studentsâ€¦</p>
      ) : students.length === 0 ? (
        <div
          style={{
            ...s.card,
            ...s.empty,
            marginTop: 4,
            padding: '2.2rem 1.5rem',
            borderRadius: 16,
            background: 'linear-gradient(135deg, #ffffff 0%, #f8fbff 100%)',
            boxShadow: '0 10px 28px rgba(18,59,93,0.06)',
          }}
        >
          No students found. Click "Add Student" to add one.
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
                <tr
                  key={st.id}
                  style={{
                    opacity: st.isActive ? 1 : 0.58,
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
                  <td style={s.td}>{st.rollNumber}</td>
                  <td style={s.td}>{st.fullName}</td>
                  <td style={s.td}>{st.guardianName}</td>
                  <td style={s.td}>{st.guardianPhone || 'â€”'}</td>
                  <td style={s.td}>{st.className}</td>
                  <td style={s.td}>
                    <span
                      style={{
                        ...(st.isActive ? s.badgeGreen : s.badgeGrey),
                        borderRadius: 999,
                        padding: '5px 10px',
                        fontSize: 12,
                        fontWeight: 750,
                        letterSpacing: 0.15,
                        boxShadow: st.isActive
                          ? '0 3px 9px rgba(21,128,61,0.12)'
                          : '0 3px 9px rgba(100,116,139,0.10)',
                      }}
                    >
                      {st.isActive ? 'Active' : 'Inactive'}
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
                         style={{
                           ...s.btnSecondary,
                           ...s.btnSmall,
                           borderRadius: 9,
                           fontWeight: 700,
                           transition: 'transform 150ms ease, box-shadow 150ms ease',
                         }}
                         onClick={() => openEdit(st)}
                         onMouseEnter={e => {
                           e.currentTarget.style.transform = 'translateY(-1px)';
                           e.currentTarget.style.boxShadow = '0 5px 12px rgba(15,23,42,0.09)';
                         }}
                         onMouseLeave={e => {
                           e.currentTarget.style.transform = '';
                           e.currentTarget.style.boxShadow = '';
                         }}
                       >Edit</button>
                      <button
                         style={{
                           ...s.btnSecondary,
                           ...s.btnSmall,
                           borderRadius: 9,
                           fontWeight: 700,
                           transition: 'transform 150ms ease, box-shadow 150ms ease',
                         }}
                         onClick={() => openParentMessage(st)}
                         onMouseEnter={e => {
                           e.currentTarget.style.transform = 'translateY(-1px)';
                           e.currentTarget.style.boxShadow = '0 5px 12px rgba(15,23,42,0.09)';
                         }}
                         onMouseLeave={e => {
                           e.currentTarget.style.transform = '';
                           e.currentTarget.style.boxShadow = '';
                         }}
                       >Message</button>
                      <button
                        style={{
                           ...(st.isActive ? s.btnDanger : s.btnSecondary),
                           ...s.btnSmall,
                           borderRadius: 9,
                           fontWeight: 700,
                           transition: 'transform 150ms ease, box-shadow 150ms ease',
                         }}
                        onClick={() => handleToggleActive(st)}
                        disabled={actionBusy === st.id}
                      >
                        {actionBusy === st.id ? 'â€¦' : (st.isActive ? 'Delete' : 'Activate')}
                      </button>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* â”€â”€ Add / Edit modal â”€â”€ */}
      {messageStudent && (
        <div style={s.modal} onClick={() => setMessageStudent(null)}>
          <div
            style={{
              ...s.modalCard,
              borderRadius: 18,
              border: `1px solid ${s.border}`,
              boxShadow: '0 24px 70px rgba(15,23,42,0.20)',
              background: 'linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <h2 style={{ ...s.modalTitle, marginBottom: 6 }}>Parent Message</h2>
            <p style={s.muted}>
              {messageStudent.fullName} - {messageStudent.guardianName || "Parent/Guardian"}
            </p>

            <label style={s.label}>
              Message Type
              <select
                style={s.input}
                value={messageType}
                onChange={e => setMessageType(e.target.value as typeof messageType)}
              >
                <option value="fee">Fee Reminder</option>
                <option value="attendance">Attendance / Absent</option>
                <option value="general">General Notice</option>
                <option value="custom">Custom Message</option>
              </select>
            </label>

            {messageType === "custom" ? (
              <label style={s.label}>
                Message
                <textarea
                  style={{ ...s.input, minHeight: "120px", resize: "vertical" }}
                  value={customMessage}
                  onChange={e => setCustomMessage(e.target.value)}
                />
              </label>
            ) : (
              <div style={{ ...s.input, minHeight: "120px", whiteSpace: "pre-wrap", background: "#f8fafc" }}>
                {buildParentMessage(messageStudent)}
              </div>
            )}

            <div style={s.actions}>
              <button
                type="button"
                style={s.btnSecondary}
                onClick={() => setMessageStudent(null)}
              >
                Cancel
              </button>

              <button
                type="button"
                style={s.btnSecondary}
                onClick={() => {
                  const message = buildParentMessage(messageStudent);
                  if (message) {
                    void navigator.clipboard?.writeText(message);
                    showNotice("Message copied");
                  }
                }}
              >
                Copy Message
              </button>

              <button
                type="button"
                style={s.btn}
                onClick={sendParentWhatsApp}
              >
                Send WhatsApp
              </button>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div style={s.modal} onClick={() => setShowModal(false)}>
          <div
            style={{
              ...s.modalCard,
              borderRadius: 18,
              border: `1px solid ${s.border}`,
              boxShadow: '0 24px 70px rgba(15,23,42,0.20)',
              background: 'linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <h2 style={{ ...s.modalTitle, marginBottom: 8 }}>
              {form.id === null ? 'Add Student' : 'Edit Student'}
            </h2>
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
                <select
                  id="sclass"
                  style={s.select}
                  value={form.classId}
                  onChange={e => {
                    const classId = e.target.value === '' ? '' : Number(e.target.value);
                    const firstStructure = feeStructures.find(
                      fs => fs.isActive && fs.classId === classId
                    );

                    setForm({
                      ...form,
                      classId,
                      feeStructureId: firstStructure?.id ?? '',
                      monthlyFee: firstStructure ? String(firstStructure.amount) : '',
                    });
                  }}
                  required
                >
                  <option value="">Select class?</option>
                  {activeClasses.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name}{c.section ? ` ? ${c.section}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {(
                form.id === null || form.id !== null
              ) && (
                <div style={{
                  marginTop: 4,
                  padding: 16,
                  border: `1px solid ${s.border}`,
                  borderRadius: 14,
                  background: 'linear-gradient(135deg, #f8fbff 0%, #eef6ff 100%)',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.85)',
                }}>
                  <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>
                    Fee Plan
                  </div>

                  <div style={{
                    fontSize: 12,
                    color: '#5B6B7A',
                    marginBottom: 14,
                  }}>
                    Set this child's recurring monthly fee. Monthly fee records are created automatically when needed.
                  </div>

                  <div style={s.row}>
                    <div style={{ ...s.field, flex: '1 1 180px' }}>
                      <label style={s.label} htmlFor="feeType">Fee Type *</label>
                      <select
                        id="feeType"
                        style={s.select}
                        value={form.feeStructureId}
                        onChange={e => {
                          const feeStructureId =
                            e.target.value === '' ? '' : Number(e.target.value);
                          const selected = feeStructures.find(
                            fs => fs.id === feeStructureId
                          );

                          setForm({
                            ...form,
                            feeStructureId,
                            monthlyFee: selected ? String(selected.amount) : '',
                          });
                        }}
                        required
                      >
                        <option value="">Select fee type?</option>
                        {feeStructures
                          .filter(fs => fs.isActive && fs.classId === form.classId)
                          .map(fs => (
                            <option key={fs.id} value={fs.id}>
                              {fs.feeName}
                            </option>
                          ))}
                      </select>
                    </div>

                    <div style={{ ...s.field, flex: '1 1 150px' }}>
                      <label style={s.label} htmlFor="standardFee">
                        Standard Fee
                      </label>
                      <input
                        id="standardFee"
                        style={s.input}
                        value={
                          feeStructures.find(fs => fs.id === form.feeStructureId)
                            ? `Rs. ${feeStructures
                                .find(fs => fs.id === form.feeStructureId)!
                                .amount.toLocaleString()}`
                            : '?'
                        }
                        readOnly
                      />
                    </div>
                  </div>

                  <div style={s.row}>
                    <div style={{ ...s.field, flex: '1 1 180px' }}>
                      <label style={s.label} htmlFor="monthlyFee">
                        Actual Monthly Fee *
                      </label>
                      <input
                        id="monthlyFee"
                        type="number"
                        min="0"
                        step="1"
                        style={s.input}
                        value={form.monthlyFee}
                        onChange={e =>
                          setForm({ ...form, monthlyFee: e.target.value })
                        }
                        placeholder="e.g. 4500"
                        required
                      />
                    </div>

                    <div style={{ ...s.field, flex: '1 1 180px' }}>
                      <label style={s.label} htmlFor="feeEffectiveFrom">
                        Effective From *
                      </label>
                      <input
                        id="feeEffectiveFrom"
                        type="date"
                        style={s.input}
                        value={form.feeEffectiveFrom}
                        onChange={e =>
                          setForm({
                            ...form,
                            feeEffectiveFrom: e.target.value,
                          })
                        }
                        required
                      />
                    </div>
                  </div>
                </div>
              )}

              {error && <p style={s.errText} role="alert">{error}</p>}
              <div style={s.modalActions}>
                <button type="button" style={s.btnSecondary} onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" style={s.btn} disabled={saving}>{saving ? 'Savingâ€¦' : 'Save'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

