import React, { useEffect, useMemo, useState } from 'react';
import type {
  FeeStructure,
  StudentFee,
  FeePayment,
  FeeSummary,
  StudentSummary,
  ClassSummary,
} from '@school/shared';

import { feesApi } from '../api/fees.js';
import { studentsApi } from '../api/students.js';
import { classesApi } from '../api/classes.js';
import { s, colors } from '../styles/shared.js';

function formatAmount(amount: number): string {
  return `Rs. ${amount.toLocaleString()}`;
}

function statusStyle(status: StudentFee['status']) {
  if (status === 'paid') {
    return { ...s.badge, ...s.badgeGreen };
  }

  if (status === 'partial') {
    return { ...s.badge, ...s.badgeAmber };
  }

  return { ...s.badge, ...s.badgeRed };
}

function statusLabel(status: StudentFee['status']): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function currentMonth(): string {
  const now = new Date();

  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
    2,
    '0'
  )}`;
}

function today(): string {
  const now = new Date();

  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-');
}

export function FeesPage() {
  const [structures, setStructures] = useState<FeeStructure[]>([]);
  const [studentFees, setStudentFees] = useState<StudentFee[]>([]);
  const [summary, setSummary] = useState<FeeSummary | null>(null);
  const [students, setStudents] = useState<StudentSummary[]>([]);
  const [classes, setClasses] = useState<ClassSummary[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [selectedFeeId, setSelectedFeeId] = useState<number | null>(null);
  const [payments, setPayments] = useState<FeePayment[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);

  const [structureForm, setStructureForm] = useState({
    classId: '',
    feeName: 'Monthly Tuition Fee',
    amount: '',
  });

  const [studentFeeForm, setStudentFeeForm] = useState({
    studentId: '',
    feeStructureId: '',
    feePeriod: currentMonth(),
    amountDue: '',
    notes: '',
  });

  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    paymentDate: today(),
    paymentMethod: 'cash' as FeePayment['paymentMethod'],
    receiptNumber: '',
    notes: '',
  });

  async function loadData() {
    setLoading(true);
    setError('');

    const [
      structuresRes,
      feesRes,
      summaryRes,
      studentsRes,
      classesRes,
    ] = await Promise.all([
      feesApi.listStructures(),
      feesApi.listStudentFees(),
      feesApi.getSummary(),
      studentsApi.list(),
      classesApi.list(),
    ]);

    if (!structuresRes.success) {
      setError(structuresRes.error ?? 'Failed to load fee structures.');
      setLoading(false);
      return;
    }

    if (!feesRes.success) {
      setError(feesRes.error ?? 'Failed to load student fees.');
      setLoading(false);
      return;
    }

    if (!summaryRes.success) {
      setError(summaryRes.error ?? 'Failed to load fee summary.');
      setLoading(false);
      return;
    }

    if (!studentsRes.success) {
      setError(studentsRes.error ?? 'Failed to load students.');
      setLoading(false);
      return;
    }

    if (!classesRes.success) {
      setError(classesRes.error ?? 'Failed to load classes.');
      setLoading(false);
      return;
    }

    setStructures(structuresRes.data ?? []);
    setStudentFees(feesRes.data ?? []);
    setSummary(summaryRes.data ?? null);
    setStudents(studentsRes.data ?? []);
    setClasses(classesRes.data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    void loadData();
  }, []);

  const selectedFee = useMemo(
    () => studentFees.find((fee) => fee.id === selectedFeeId) ?? null,
    [studentFees, selectedFeeId]
  );

  async function loadPayments(studentFeeId: number) {
    setPaymentsLoading(true);
    setPayments([]);

    const res = await feesApi.listPayments(studentFeeId);

    if (!res.success) {
      setError(res.error ?? 'Failed to load payment history.');
      setPaymentsLoading(false);
      return;
    }

    setPayments(res.data ?? []);
    setPaymentsLoading(false);
  }

  function selectFee(fee: StudentFee) {
    setSelectedFeeId(fee.id);
    setError('');
    setNotice('');

    void loadPayments(fee.id);

    setPaymentForm({
      amount:
        fee.amountRemaining > 0 ? String(fee.amountRemaining) : '',
      paymentDate: today(),
      paymentMethod: 'cash',
      receiptNumber: '',
      notes: '',
    });
  }

  async function createStructure(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setNotice('');

    const classId = Number(structureForm.classId);
    const amount = Number(structureForm.amount);

    if (!Number.isInteger(classId) || classId < 1) {
      setError('Please select a class.');
      return;
    }

    if (!Number.isInteger(amount) || amount < 0) {
      setError(
        'Fee amount must be a valid non-negative whole number.'
      );
      return;
    }

    if (!structureForm.feeName.trim()) {
      setError('Fee name is required.');
      return;
    }

    setSaving(true);

    const res = await feesApi.createStructure({
      classId,
      feeName: structureForm.feeName.trim(),
      amount,
    });

    if (!res.success) {
      setError(res.error ?? 'Failed to create fee structure.');
      setSaving(false);
      return;
    }

    setStructureForm({
      classId: '',
      feeName: 'Monthly Tuition Fee',
      amount: '',
    });

    setNotice('Fee structure created successfully.');
    setSaving(false);

    await loadData();
  }

  async function createStudentFee(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setNotice('');

    const studentId = Number(studentFeeForm.studentId);

    const feeStructureId = studentFeeForm.feeStructureId
      ? Number(studentFeeForm.feeStructureId)
      : undefined;

    const amountDue = Number(studentFeeForm.amountDue);

    if (!Number.isInteger(studentId) || studentId < 1) {
      setError('Please select a student.');
      return;
    }

    if (!/^\d{4}-\d{2}$/.test(studentFeeForm.feePeriod)) {
      setError('Fee period must use YYYY-MM format.');
      return;
    }

    if (!Number.isInteger(amountDue) || amountDue < 0) {
      setError(
        'Amount due must be a valid non-negative whole number.'
      );
      return;
    }

    if (
      feeStructureId !== undefined &&
      (!Number.isInteger(feeStructureId) || feeStructureId < 1)
    ) {
      setError('Invalid fee structure.');
      return;
    }

    setSaving(true);

    const res = await feesApi.createStudentFee({
      studentId,
      feeStructureId,
      feePeriod: studentFeeForm.feePeriod,
      amountDue,
      notes: studentFeeForm.notes.trim() || undefined,
    });

    if (!res.success) {
      setError(res.error ?? 'Failed to create student fee.');
      setSaving(false);
      return;
    }

    setStudentFeeForm({
      studentId: '',
      feeStructureId: '',
      feePeriod: currentMonth(),
      amountDue: '',
      notes: '',
    });

    setNotice('Student fee created successfully.');
    setSaving(false);

    await loadData();
  }

  function handleFeeStructureChange(value: string) {
    setStudentFeeForm((current) => ({
      ...current,
      feeStructureId: value,
      amountDue:
        value &&
        structures.find((item) => item.id === Number(value))
          ? String(
              structures.find(
                (item) => item.id === Number(value)
              )?.amount ?? ''
            )
          : current.amountDue,
    }));
  }

  async function createPayment(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setNotice('');

    if (!selectedFee) {
      setError('Select a student fee first.');
      return;
    }

    const amount = Number(paymentForm.amount);

    if (!Number.isInteger(amount) || amount < 1) {
      setError(
        'Payment amount must be a positive whole number.'
      );
      return;
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(paymentForm.paymentDate)) {
      setError('Payment date must use YYYY-MM-DD format.');
      return;
    }

    if (!paymentForm.receiptNumber.trim()) {
      setError('Receipt number is required.');
      return;
    }

    if (amount > selectedFee.amountRemaining) {
      setError(
        `Payment cannot exceed remaining balance of ${formatAmount(
          selectedFee.amountRemaining
        )}.`
      );
      return;
    }

    setSaving(true);

    const res = await feesApi.createPayment({
      studentFeeId: selectedFee.id,
      amount,
      paymentDate: paymentForm.paymentDate,
      paymentMethod: paymentForm.paymentMethod,
      receiptNumber: paymentForm.receiptNumber.trim(),
      notes: paymentForm.notes.trim() || undefined,
    });

    if (!res.success) {
      setError(res.error ?? 'Failed to record payment.');
      setSaving(false);
      return;
    }

    setNotice('Payment recorded successfully.');
    setSaving(false);

    setPaymentForm({
      amount: '',
      paymentDate: today(),
      paymentMethod: 'cash',
      receiptNumber: '',
      notes: '',
    });

    await loadData();
    await loadPayments(selectedFee.id);
  }

  return (
    <div>
      {summary && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns:
              'repeat(auto-fit, minmax(160px, 1fr))',
            gap: '1rem',
            marginBottom: '1.5rem',
          }}
        >
          <div style={s.card}>
            <div
              style={{
                color: colors.muted,
                fontSize: '0.85rem',
              }}
            >
              Total Due
            </div>

            <div
              style={{
                fontSize: '1.5rem',
                fontWeight: 700,
              }}
            >
              {formatAmount(summary.totalDue)}
            </div>
          </div>

          <div style={s.card}>
            <div
              style={{
                color: colors.muted,
                fontSize: '0.85rem',
              }}
            >
              Total Paid
            </div>

            <div
              style={{
                fontSize: '1.5rem',
                fontWeight: 700,
              }}
            >
              {formatAmount(summary.totalPaid)}
            </div>
          </div>

          <div style={s.card}>
            <div
              style={{
                color: colors.muted,
                fontSize: '0.85rem',
              }}
            >
              Remaining
            </div>

            <div
              style={{
                fontSize: '1.5rem',
                fontWeight: 700,
              }}
            >
              {formatAmount(summary.totalRemaining)}
            </div>
          </div>

          <div style={s.card}>
            <div
              style={{
                color: colors.muted,
                fontSize: '0.85rem',
              }}
            >
              Unpaid
            </div>

            <div
              style={{
                fontSize: '1.5rem',
                fontWeight: 700,
              }}
            >
              {summary.unpaidCount}
            </div>
          </div>

          <div style={s.card}>
            <div
              style={{
                color: colors.muted,
                fontSize: '0.85rem',
              }}
            >
              Partial
            </div>

            <div
              style={{
                fontSize: '1.5rem',
                fontWeight: 700,
              }}
            >
              {summary.partialCount}
            </div>
          </div>

          <div style={s.card}>
            <div
              style={{
                color: colors.muted,
                fontSize: '0.85rem',
              }}
            >
              Paid
            </div>

            <div
              style={{
                fontSize: '1.5rem',
                fontWeight: 700,
              }}
            >
              {summary.paidCount}
            </div>
          </div>
        </div>
      )}

      <div>
        <h1 style={s.pageTitle}>Fees</h1>

        <p style={s.muted}>
          Manage class fee structures, student monthly fees, and
          payment history.
        </p>

        {error && <p style={s.errText}>{error}</p>}
        {notice && <p style={s.okText}>{notice}</p>}

        {loading ? (
          <p style={s.spinner}>Loading fees...</p>
        ) : (
          <>
            <section style={s.card}>
              <h2 style={s.formTitle}>Fee Structures</h2>

              <form
                onSubmit={createStructure}
                style={s.form}
              >
                <div style={s.row}>
                  <div
                    style={{
                      ...s.field,
                      flex: '1 1 180px',
                    }}
                  >
                    <label style={s.label}>Class</label>

                    <select
                      style={s.select}
                      value={structureForm.classId}
                      onChange={(event) =>
                        setStructureForm((current) => ({
                          ...current,
                          classId: event.target.value,
                        }))
                      }
                    >
                      <option value="">
                        Select class
                      </option>

                      {classes.map((item) => (
                        <option
                          key={item.id}
                          value={item.id}
                        >
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div
                    style={{
                      ...s.field,
                      flex: '1 1 220px',
                    }}
                  >
                    <label style={s.label}>Fee Name</label>

                    <input
                      style={s.input}
                      value={structureForm.feeName}
                      onChange={(event) =>
                        setStructureForm((current) => ({
                          ...current,
                          feeName: event.target.value,
                        }))
                      }
                      maxLength={100}
                    />
                  </div>

                  <div
                    style={{
                      ...s.field,
                      flex: '0 1 160px',
                    }}
                  >
                    <label style={s.label}>Amount</label>

                    <input
                      style={s.input}
                      type="number"
                      min="0"
                      step="1"
                      value={structureForm.amount}
                      onChange={(event) =>
                        setStructureForm((current) => ({
                          ...current,
                          amount: event.target.value,
                        }))
                      }
                    />
                  </div>

                  <button
                    style={s.btn}
                    type="submit"
                    disabled={saving}
                  >
                    {saving ? 'Saving...' : 'Add Structure'}
                  </button>
                </div>
              </form>

              <div
                style={{
                  ...s.tableWrap,
                  marginTop: '1rem',
                }}
              >
                {structures.length === 0 ? (
                  <div style={s.empty}>
                    No fee structures yet.
                  </div>
                ) : (
                  <table style={s.table}>
                    <thead>
                      <tr>
                        <th style={s.th}>Class</th>
                        <th style={s.th}>Fee</th>
                        <th style={s.th}>Amount</th>
                        <th style={s.th}>Status</th>
                      </tr>
                    </thead>

                    <tbody>
                      {structures.map((structure) => (
                        <tr key={structure.id}>
                          <td style={s.td}>
                            {structure.className}
                          </td>

                          <td style={s.td}>
                            {structure.feeName}
                          </td>

                          <td style={s.td}>
                            {formatAmount(structure.amount)}
                          </td>

                          <td style={s.td}>
                            <span
                              style={
                                structure.isActive
                                  ? {
                                      ...s.badge,
                                      ...s.badgeGreen,
                                    }
                                  : {
                                      ...s.badge,
                                      ...s.badgeGrey,
                                    }
                              }
                            >
                              {structure.isActive
                                ? 'Active'
                                : 'Inactive'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </section>

            <section style={s.card}>
              <h2 style={s.formTitle}>
                Create Student Fee
              </h2>

              <form
                onSubmit={createStudentFee}
                style={s.form}
              >
                <div style={s.row}>
                  <div
                    style={{
                      ...s.field,
                      flex: '1 1 220px',
                    }}
                  >
                    <label style={s.label}>
                      Student
                    </label>

                    <select
                      style={s.select}
                      value={studentFeeForm.studentId}
                      onChange={(event) =>
                        setStudentFeeForm((current) => ({
                          ...current,
                          studentId:
                            event.target.value,
                        }))
                      }
                    >
                      <option value="">
                        Select student
                      </option>

                      {students.map((student) => (
                        <option
                          key={student.id}
                          value={student.id}
                        >
                          {student.rollNumber} —{' '}
                          {student.fullName}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div
                    style={{
                      ...s.field,
                      flex: '1 1 200px',
                    }}
                  >
                    <label style={s.label}>
                      Fee Structure
                    </label>

                    <select
                      style={s.select}
                      value={
                        studentFeeForm.feeStructureId
                      }
                      onChange={(event) =>
                        handleFeeStructureChange(
                          event.target.value
                        )
                      }
                    >
                      <option value="">
                        Custom / no structure
                      </option>

                      {structures.map((structure) => (
                        <option
                          key={structure.id}
                          value={structure.id}
                        >
                          {structure.className} —{' '}
                          {structure.feeName} —{' '}
                          {formatAmount(
                            structure.amount
                          )}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div
                    style={{
                      ...s.field,
                      flex: '0 1 140px',
                    }}
                  >
                    <label style={s.label}>
                      Period
                    </label>

                    <input
                      style={s.input}
                      type="month"
                      value={studentFeeForm.feePeriod}
                      onChange={(event) =>
                        setStudentFeeForm((current) => ({
                          ...current,
                          feePeriod:
                            event.target.value,
                        }))
                      }
                    />
                  </div>

                  <div
                    style={{
                      ...s.field,
                      flex: '0 1 150px',
                    }}
                  >
                    <label style={s.label}>
                      Amount Due
                    </label>

                    <input
                      style={s.input}
                      type="number"
                      min="0"
                      step="1"
                      value={studentFeeForm.amountDue}
                      onChange={(event) =>
                        setStudentFeeForm((current) => ({
                          ...current,
                          amountDue:
                            event.target.value,
                        }))
                      }
                    />
                  </div>

                  <button
                    style={s.btn}
                    type="submit"
                    disabled={saving}
                  >
                    {saving ? 'Saving...' : 'Create Fee'}
                  </button>
                </div>

                <div style={s.row}>
                  <div
                    style={{
                      ...s.field,
                      flex: '1 1 100%',
                    }}
                  >
                    <label style={s.label}>
                      Notes (optional)
                    </label>

                    <input
                      style={s.input}
                      value={studentFeeForm.notes}
                      onChange={(event) =>
                        setStudentFeeForm((current) => ({
                          ...current,
                          notes: event.target.value,
                        }))
                      }
                      maxLength={500}
                      placeholder="Optional note"
                    />
                  </div>
                </div>
              </form>
            </section>

            <section style={s.card}>
              <div style={s.between}>
                <div>
                  <h2
                    style={{
                      ...s.formTitle,
                      marginBottom: 2,
                    }}
                  >
                    Student Fees
                  </h2>

                  <span style={s.muted}>
                    Select a fee to view its payment
                    history.
                  </span>
                </div>

                <span style={s.muted}>
                  {studentFees.length} record
                  {studentFees.length === 1
                    ? ''
                    : 's'}
                </span>
              </div>

              <div style={s.tableWrap}>
                {studentFees.length === 0 ? (
                  <div style={s.empty}>
                    No student fee records yet.
                  </div>
                ) : (
                  <table style={s.table}>
                    <thead>
                      <tr>
                        <th style={s.th}>Student</th>
                        <th style={s.th}>Roll No.</th>
                        <th style={s.th}>Period</th>
                        <th style={s.th}>Due</th>
                        <th style={s.th}>Paid</th>
                        <th style={s.th}>Remaining</th>
                        <th style={s.th}>Status</th>
                        <th style={s.th}>Action</th>
                      </tr>
                    </thead>

                    <tbody>
                      {studentFees.map((fee) => (
                        <tr key={fee.id}>
                          <td style={s.td}>
                            {fee.studentName}
                          </td>

                          <td style={s.td}>
                            {fee.rollNumber}
                          </td>

                          <td style={s.td}>
                            {fee.feePeriod}
                          </td>

                          <td style={s.td}>
                            {formatAmount(fee.amountDue)}
                          </td>

                          <td style={s.td}>
                            {formatAmount(fee.amountPaid)}
                          </td>

                          <td style={s.td}>
                            {formatAmount(
                              fee.amountRemaining
                            )}
                          </td>

                          <td style={s.td}>
                            <span
                              style={statusStyle(
                                fee.status
                              )}
                            >
                              {statusLabel(fee.status)}
                            </span>
                          </td>

                          <td style={s.td}>
                            <button
                              type="button"
                              style={{
                                ...s.btnSecondary,
                                ...s.btnSmall,
                              }}
                              onClick={() =>
                                selectFee(fee)
                              }
                            >
                              {selectedFeeId === fee.id
                                ? 'Selected'
                                : 'Payments'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </section>

            {selectedFee && (
              <section style={s.card}>
                <div style={s.between}>
                  <div>
                    <h2
                      style={{
                        ...s.formTitle,
                        marginBottom: 2,
                      }}
                    >
                      Payment —{' '}
                      {selectedFee.studentName}
                    </h2>

                    <span style={s.muted}>
                      {selectedFee.rollNumber} ·{' '}
                      {selectedFee.feePeriod} ·
                      {' Remaining '}
                      {formatAmount(
                        selectedFee.amountRemaining
                      )}
                    </span>
                  </div>

                  <span
                    style={statusStyle(
                      selectedFee.status
                    )}
                  >
                    {statusLabel(selectedFee.status)}
                  </span>
                </div>

                {selectedFee.amountRemaining > 0 ? (
                  <form
                    onSubmit={createPayment}
                    style={s.form}
                  >
                    <div style={s.row}>
                      <div
                        style={{
                          ...s.field,
                          flex: '0 1 150px',
                        }}
                      >
                        <label style={s.label}>
                          Payment Amount
                        </label>

                        <input
                          style={s.input}
                          type="number"
                          min="1"
                          max={
                            selectedFee.amountRemaining
                          }
                          step="1"
                          value={paymentForm.amount}
                          onChange={(event) =>
                            setPaymentForm(
                              (current) => ({
                                ...current,
                                amount:
                                  event.target.value,
                              })
                            )
                          }
                        />
                      </div>

                      <div
                        style={{
                          ...s.field,
                          flex: '0 1 160px',
                        }}
                      >
                        <label style={s.label}>
                          Payment Date
                        </label>

                        <input
                          style={s.input}
                          type="date"
                          value={
                            paymentForm.paymentDate
                          }
                          onChange={(event) =>
                            setPaymentForm(
                              (current) => ({
                                ...current,
                                paymentDate:
                                  event.target.value,
                              })
                            )
                          }
                        />
                      </div>

                      <div
                        style={{
                          ...s.field,
                          flex: '0 1 160px',
                        }}
                      >
                        <label style={s.label}>
                          Method
                        </label>

                        <select
                          style={s.select}
                          value={
                            paymentForm.paymentMethod
                          }
                          onChange={(event) =>
                            setPaymentForm(
                              (current) => ({
                                ...current,
                                paymentMethod:
                                  event.target
                                    .value as FeePayment['paymentMethod'],
                              })
                            )
                          }
                        >
                          <option value="cash">
                            Cash
                          </option>
                          <option value="bank">
                            Bank
                          </option>
                          <option value="online">
                            Online
                          </option>
                          <option value="other">
                            Other
                          </option>
                        </select>
                      </div>

                      <div
                        style={{
                          ...s.field,
                          flex: '1 1 180px',
                        }}
                      >
                        <label style={s.label}>
                          Receipt Number
                        </label>

                        <input
                          style={s.input}
                          value={
                            paymentForm.receiptNumber
                          }
                          onChange={(event) =>
                            setPaymentForm(
                              (current) => ({
                                ...current,
                                receiptNumber:
                                  event.target.value,
                              })
                            )
                          }
                          maxLength={100}
                        />
                      </div>

                      <button
                        style={s.btn}
                        type="submit"
                        disabled={saving}
                      >
                        {saving
                          ? 'Saving...'
                          : 'Record Payment'}
                      </button>
                    </div>

                    <div style={s.row}>
                      <div
                        style={{
                          ...s.field,
                          flex: '1 1 100%',
                        }}
                      >
                        <label style={s.label}>
                          Notes (optional)
                        </label>

                        <input
                          style={s.input}
                          value={paymentForm.notes}
                          onChange={(event) =>
                            setPaymentForm(
                              (current) => ({
                                ...current,
                                notes:
                                  event.target.value,
                              })
                            )
                          }
                          maxLength={500}
                          placeholder="Optional payment note"
                        />
                      </div>
                    </div>
                  </form>
                ) : (
                  <p style={s.okText}>
                    This fee is fully paid.
                  </p>
                )}

                <div
                  style={{
                    marginTop: '1.25rem',
                  }}
                >
                  <h3
                    style={{
                      ...s.formTitle,
                      marginBottom: '0.6rem',
                    }}
                  >
                    Payment History
                  </h3>

                  {paymentsLoading ? (
                    <p style={s.spinner}>
                      Loading payment history...
                    </p>
                  ) : payments.length === 0 ? (
                    <div style={s.empty}>
                      No payments recorded yet.
                    </div>
                  ) : (
                    <div style={s.tableWrap}>
                      <table style={s.table}>
                        <thead>
                          <tr>
                            <th style={s.th}>Date</th>
                            <th style={s.th}>Amount</th>
                            <th style={s.th}>Method</th>
                            <th style={s.th}>Receipt</th>
                            <th style={s.th}>
                              Received By
                            </th>
                          </tr>
                        </thead>

                        <tbody>
                          {payments.map((payment) => (
                            <tr key={payment.id}>
                              <td style={s.td}>
                                {payment.paymentDate}
                              </td>

                              <td style={s.td}>
                                {formatAmount(
                                  payment.amount
                                )}
                              </td>

                              <td style={s.td}>
                                {payment.paymentMethod}
                              </td>

                              <td style={s.td}>
                                {payment.receiptNumber}
                              </td>

                              <td style={s.td}>
                                {payment.receivedByName}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
