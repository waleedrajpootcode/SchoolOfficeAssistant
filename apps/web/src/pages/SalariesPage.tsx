import { useEffect, useMemo, useState } from 'react';
import type {
  TeacherSalary,
  CreateTeacherSalaryRequest,
} from '@school/shared';

import { salariesApi } from '../api/salaries.js';
import { usersApi } from '../api/users.js';
import { teacherProfilesApi } from '../api/teacherProfiles.js';

interface Teacher {
  id: number;
  username: string;
  displayName: string;
  role: string;
  isActive: boolean;
  createdAt: string;
}

const emptyForm: CreateTeacherSalaryRequest = {
  teacherId: 0,
  salaryPeriod: new Date().toISOString().slice(0, 7),
  salaryDue: 0,
  notes: '',
};

function formatMoney(value: number): string {
  return new Intl.NumberFormat('en-PK').format(value);
}

function statusStyle(status: TeacherSalary['status']) {
  if (status === 'paid') {
    return {
      background: '#dcfce7',
      color: '#166534',
    };
  }

  if (status === 'partial') {
    return {
      background: '#fef3c7',
      color: '#92400e',
    };
  }

  return {
    background: '#fee2e2',
    color: '#991b1b',
  };
}

export function SalariesPage() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [salaries, setSalaries] = useState<TeacherSalary[]>([]);
  const [form, setForm] = useState<CreateTeacherSalaryRequest>(emptyForm);
  const [filterPeriod, setFilterPeriod] = useState(
    new Date().toISOString().slice(0, 7)
  );

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [paymentSalary, setPaymentSalary] = useState<TeacherSalary | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'bank' | 'online' | 'other'>('cash');

  const activeTeachers = useMemo(
    () => teachers.filter((teacher) => teacher.role === 'teacher' && teacher.isActive),
    [teachers]
  );

  const totals = useMemo(() => {
    return salaries.reduce(
      (acc, salary) => {
        acc.due += salary.salaryDue;
        acc.paid += salary.salaryPaid;
        acc.remaining += salary.salaryRemaining;
        return acc;
      },
      { due: 0, paid: 0, remaining: 0 }
    );
  }, [salaries]);

  useEffect(() => {
    void loadInitialData();
  }, []);

  useEffect(() => {
    void loadSalaries();
  }, [filterPeriod]);

  async function loadInitialData() {
    setLoading(true);
    setError('');

    const teachersResult = await usersApi.list();

    if (!teachersResult.success || !teachersResult.data) {
      setError(teachersResult.error ?? 'Unable to load teachers.');
      setLoading(false);
      return;
    }

    setTeachers(teachersResult.data as Teacher[]);

    const firstTeacher = teachersResult.data.find(
      (teacher) => teacher.role === 'teacher' && teacher.isActive
    );

    if (firstTeacher) {
      setForm((current) => ({
        ...current,
        teacherId: firstTeacher.id,
      }));
      await loadTeacherSalary(firstTeacher.id);
    }

    await loadSalaries();
    setLoading(false);
  }

  async function loadTeacherSalary(teacherId: number) {
    if (!teacherId) {
      return;
    }

    const result = await teacherProfilesApi.get(teacherId);

    if (!result.success || !result.data) {
      return;
    }

    const monthlySalary = result.data.monthlySalary;

    setForm((current) => ({
      ...current,
      salaryDue: Number(monthlySalary ?? 0),
    }));
  }
  async function loadSalaries() {
    const result = await salariesApi.list({
      period: filterPeriod || undefined,
    });

    if (!result.success || !result.data) {
      setError(result.error ?? 'Unable to load salaries.');
      return;
    }

    setSalaries(result.data);
  }

  async function createSalary() {
    setError('');
    setNotice('');

    if (!form.teacherId) {
      setError('Please select a teacher.');
      return;
    }

    if (!form.salaryPeriod || !/^\d{4}-\d{2}$/.test(form.salaryPeriod)) {
      setError('Please enter a valid salary month.');
      return;
    }

    if (!Number.isInteger(form.salaryDue) || form.salaryDue < 0) {
      setError('Salary amount must be a valid non-negative number.');
      return;
    }

    setSaving(true);

    const existing = await salariesApi.list({ teacherId: Number(form.teacherId), period: form.salaryPeriod });
    if (existing.success && existing.data && existing.data.length > 0) {
      setError('Salary record already exists for this teacher and month.');
      setSaving(false);
      return;
    }

    const result = await salariesApi.create({
      teacherId: Number(form.teacherId),
      salaryPeriod: form.salaryPeriod,
      salaryDue: Number(form.salaryDue),
      notes: form.notes?.trim() || undefined,
    });

    if (!result.success || !result.data) {
      setError(result.error ?? 'Unable to create salary record.');
      setSaving(false);
      return;
    }

    setNotice('Salary record created successfully.');
    setForm((current) => ({
      ...emptyForm,
      teacherId: current.teacherId,
      salaryPeriod: current.salaryPeriod,
    }));

    await loadSalaries();
    setSaving(false);
  }

  function openPaymentModal(salary: TeacherSalary) { setError(''); setNotice(''); setPaymentSalary(salary); setPaymentAmount(String(salary.salaryPaid)); setPaymentMethod(salary.paymentMethod ?? 'cash'); } async function savePayment() { if (!paymentSalary) { return; } setError(''); setNotice(''); const paid = Number(paymentAmount); if (!Number.isInteger(paid) || paid < 0 || paid > paymentSalary.salaryDue) { setError(`Paid amount must be between 0 and ${paymentSalary.salaryDue}.`); return; } const result = await salariesApi.update(paymentSalary.id, { salaryPaid: paid, paymentDate: paid > 0 ? new Date().toISOString().slice(0, 10) : undefined, paymentMethod, }); if (!result.success || !result.data) { setError(result.error ?? 'Unable to update salary payment.'); return; } setPaymentSalary(null); setNotice('Salary payment updated successfully.'); await loadSalaries(); }

  if (loading) {
    return (
      <div style={styles.page}>
        <p>Loading salaries...</p>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Teacher Salaries</h1>
          <p style={styles.subtitle}>
            Manage monthly teacher salaries, payments and outstanding balances.
          </p>
        </div>

        <label style={styles.filterLabel}>
          Salary Month
          <input
            type="month"
            value={filterPeriod}
            onChange={(event) => setFilterPeriod(event.target.value)}
            style={styles.input}
          />
        </label>
      </div>

      {error && <div style={styles.error}>{error}</div>}
      {notice && <div style={styles.notice}>{notice}</div>}

      <div style={styles.cards}>
        <div style={styles.card}>
          <span style={styles.cardLabel}>Total Due</span>
          <strong style={styles.cardValue}>Rs. {formatMoney(totals.due)}</strong>
        </div>

        <div style={styles.card}>
          <span style={styles.cardLabel}>Total Paid</span>
          <strong style={styles.cardValue}>Rs. {formatMoney(totals.paid)}</strong>
        </div>

        <div style={styles.card}>
          <span style={styles.cardLabel}>Pending</span>
          <strong style={styles.cardValue}>
            Rs. {formatMoney(totals.remaining)}
          </strong>
        </div>
      </div>

      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>Add Monthly Salary</h2>

        <div style={styles.formGrid}>
          <label style={styles.field}>
            Teacher
            <select
              value={form.teacherId}
              onChange={(event) => { const teacherId = Number(event.target.value); setForm((current) => ({ ...current, teacherId, salaryDue: 0 })); void loadTeacherSalary(teacherId); }}
              style={styles.input}
            >
              <option value={0}>Select teacher</option>
              {activeTeachers.map((teacher) => (
                <option key={teacher.id} value={teacher.id}>
                  {teacher.displayName} ({teacher.username})
                </option>
              ))}
            </select>
          </label>

          <label style={styles.field}>
            Salary Month
            <input
              type="month"
              value={form.salaryPeriod}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  salaryPeriod: event.target.value,
                }))
              }
              style={styles.input}
            />
          </label>

          <label style={styles.field}>
            Salary Due
            <input
              type="number"
              min="0"
              step="1"
              value={form.salaryDue}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  salaryDue: Number(event.target.value),
                }))
              }
              style={styles.input}
            />
          </label>

          <label style={styles.field}>
            Notes
            <input
              type="text"
              maxLength={500}
              value={form.notes ?? ''}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  notes: event.target.value,
                }))
              }
              style={styles.input}
              placeholder="Optional"
            />
          </label>

          <button
            type="button"
            onClick={() => void createSalary()}
            disabled={saving}
            style={styles.primaryButton}
          >
            {saving ? 'Saving...' : 'Add Salary'}
          </button>
        </div>
      </section>

      <section style={styles.section}>
        <div style={styles.sectionHeader}>
          <h2 style={styles.sectionTitle}>Salary Records</h2>
          <span style={styles.count}>{salaries.length} record(s)</span>
        </div>

        {salaries.length === 0 ? (
          <div style={styles.empty}>No salary records found for this month.</div>
        ) : (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Teacher</th>
                  <th style={styles.th}>Month</th>
                  <th style={styles.th}>Due</th>
                  <th style={styles.th}>Paid</th>
                  <th style={styles.th}>Remaining</th>
                  <th style={styles.th}>Status</th>
                  <th style={styles.th}>Action</th>
                </tr>
              </thead>

              <tbody>
                {salaries.map((salary) => (
                  <tr key={salary.id}>
                    <td style={styles.td}>
                      <strong>{salary.teacherName}</strong>
                      <div style={styles.muted}>{salary.username}</div>
                    </td>
                    <td style={styles.td}>{salary.salaryPeriod}</td>
                    <td style={styles.td}>Rs. {formatMoney(salary.salaryDue)}</td>
                    <td style={styles.td}>Rs. {formatMoney(salary.salaryPaid)}</td>
                    <td style={styles.td}>
                      Rs. {formatMoney(salary.salaryRemaining)}
                    </td>
                    <td style={styles.td}>
                      <span
                        style={{
                          ...styles.badge,
                          ...statusStyle(salary.status),
                        }}
                      >
                        {salary.status.charAt(0).toUpperCase() +
                          salary.status.slice(1)}
                      </span>
                    </td>
                    <td style={styles.td}>
                      <button
                        type="button"
                        onClick={() => openPaymentModal(salary)}
                        style={styles.secondaryButton}
                      >
                        Update Payment
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    {paymentSalary && (<div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem", zIndex: 1000 }}><div style={{ background: "#fff", borderRadius: "14px", width: "100%", maxWidth: "460px", padding: "1.25rem", boxShadow: "0 20px 50px rgba(0,0,0,.2)" }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}><div><h2 style={{ margin: 0 }}>Update Salary Payment</h2><div style={styles.muted}>{paymentSalary.teacherName} - {paymentSalary.salaryPeriod}</div></div><button type="button" onClick={() => setPaymentSalary(null)} style={styles.secondaryButton}>Close</button></div><div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: ".6rem", marginBottom: "1rem" }}><div><div style={styles.muted}>Due</div><strong>Rs. {formatMoney(paymentSalary.salaryDue)}</strong></div><div><div style={styles.muted}>Paid</div><strong>Rs. {formatMoney(Number(paymentAmount || 0))}</strong></div><div><div style={styles.muted}>Remaining</div><strong>Rs. {formatMoney(Math.max(0, paymentSalary.salaryDue - Number(paymentAmount || 0)))}</strong></div></div><label style={styles.filterLabel}>Total Salary Paid<input type="number" min="0" max={paymentSalary.salaryDue} value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} style={styles.input} /></label><label style={{ ...styles.filterLabel, marginTop: ".8rem" }}>Payment Method<select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value as "cash" | "bank" | "online" | "other")} style={styles.input}><option value="cash">Cash</option><option value="bank">Bank</option><option value="online">Online</option><option value="other">Other</option></select></label><div style={{ display: "flex", justifyContent: "flex-end", gap: ".6rem", marginTop: "1.2rem" }}><button type="button" onClick={() => setPaymentSalary(null)} style={styles.secondaryButton}>Cancel</button><button type="button" onClick={() => void savePayment()} style={styles.primaryButton}>Save Payment</button></div></div></div>)}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    padding: '1.5rem',
    maxWidth: '1400px',
    margin: '0 auto',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: '1rem',
    marginBottom: '1.25rem',
    flexWrap: 'wrap',
  },
  title: {
    margin: 0,
    fontSize: '1.8rem',
    color: '#123B5D',
    letterSpacing: '-0.3px',
  },
  subtitle: {
    margin: '0.35rem 0 0',
    color: '#64748b',
  },
  filterLabel: {
    display: 'grid',
    gap: '0.35rem',
    fontSize: '0.85rem',
    fontWeight: 600,
  },
  cards: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: '0.9rem',
    marginBottom: '1.25rem',
  },
  card: {
    padding: '1.1rem',
    border: '1px solid #d9e2ec',
    borderRadius: '15px',
    background: 'linear-gradient(135deg, #ffffff 0%, #f8fbff 100%)',
    boxShadow: '0 8px 22px rgba(18,59,93,0.065)',
  },
  cardLabel: {
    display: 'block',
    color: '#64748b',
    fontSize: '0.85rem',
    marginBottom: '0.35rem',
  },
  cardValue: {
    fontSize: '1.35rem',
  },
  section: {
    background: 'linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)',
    border: '1px solid #d9e2ec',
    borderRadius: '15px',
    padding: '1.1rem',
    marginBottom: '1.25rem',
    boxShadow: '0 9px 24px rgba(18,59,93,0.055)',
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '1rem',
  },
  sectionTitle: {
    margin: '0 0 1rem',
    fontSize: '1.15rem',
  },
  count: {
    color: '#64748b',
    fontSize: '0.85rem',
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: '0.85rem',
    alignItems: 'end',
  },
  field: {
    display: 'grid',
    gap: '0.35rem',
    fontSize: '0.85rem',
    fontWeight: 600,
  },
  input: {
    width: '100%',
    boxSizing: 'border-box',
    padding: '0.65rem 0.7rem',
    border: '1px solid #cbd5e1',
    borderRadius: '9px',
    background: '#fff',
    fontSize: '0.9rem',
    transition: 'border-color 160ms ease, box-shadow 160ms ease',
  },
  primaryButton: {
    padding: '0.7rem 1rem',
    border: '1px solid rgba(18,59,93,0.18)',
    borderRadius: '9px',
    background: 'linear-gradient(135deg, #123B5D 0%, #1677C8 68%, #38BDF8 100%)',
    color: '#fff',
    fontWeight: 750,
    cursor: 'pointer',
    boxShadow: '0 7px 16px rgba(18,59,93,0.18)',
    transition: 'transform 160ms ease, box-shadow 160ms ease',
  },
  secondaryButton: {
    padding: '0.5rem 0.75rem',
    border: '1px solid #d9e2ec',
    borderRadius: '9px',
    background: 'linear-gradient(135deg, #ffffff 0%, #f8fbff 100%)',
    cursor: 'pointer',
    fontWeight: 700,
    transition: 'transform 160ms ease, box-shadow 160ms ease',
  },
  tableWrap: {
    overflowX: 'auto',
    borderRadius: '12px',
    border: '1px solid #d9e2ec',
    boxShadow: '0 7px 18px rgba(18,59,93,0.05)',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    minWidth: '850px',
  },
  th: {
    textAlign: 'left',
    padding: '0.75rem',
    borderBottom: '1px solid #d9e2ec',
    background: '#f8fbff',
    color: '#123B5D',
    fontSize: '0.82rem',
    fontWeight: 750,
  },
  td: {
    padding: '0.75rem 0.7rem',
    borderBottom: '1px solid #f1f5f9',
    verticalAlign: 'top',
    fontSize: '0.9rem',
  },
  muted: {
    color: '#64748b',
    fontSize: '0.78rem',
    marginTop: '0.2rem',
  },
  badge: {
    display: 'inline-block',
    padding: '0.3rem 0.62rem',
    borderRadius: '999px',
    fontSize: '0.75rem',
    fontWeight: 750,
    boxShadow: '0 3px 9px rgba(18,59,93,0.08)',
  },
  error: {
    padding: '0.75rem',
    marginBottom: '1rem',
    borderRadius: '8px',
    background: '#fee2e2',
    color: '#991b1b',
  },
  notice: {
    padding: '0.75rem',
    marginBottom: '1rem',
    borderRadius: '8px',
    background: '#dcfce7',
    color: '#166534',
  },
  empty: {
    padding: '2rem 1rem',
    textAlign: 'center',
    color: '#64748b',
  },
};














