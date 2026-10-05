import React, { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { studentsApi } from '../api/students.js';
import { classesApi } from '../api/classes.js';
import { feesApi } from '../api/fees.js';
import { studentFeeAssignmentsApi } from '../api/studentFeeAssignments.js';
import { familyPaymentsApi } from '../api/familyPayments.js';
import { s } from '../styles/shared.js';

interface FamilyChild {
  id: number;
  rollNumber: string;
  fullName: string;
  guardianName: string;
  guardianPhone: string | null;
  classId: number;
  className: string;
  isActive: boolean;
}

interface Family {
  id: number;
  guardianName: string;
  guardianPhone: string | null;
  address: string | null;
  notes: string | null;
  isActive: boolean;
  childrenCount: number;
  children: FamilyChild[];
  createdAt: string;
  updatedAt: string;
}

interface StudentOption {
  id: number;
  rollNumber: string;
  fullName: string;
  guardianName: string;
  guardianPhone: string | null;
  classId: number;
  className: string;
  isActive: boolean;
}

interface ClassOption {
  id: number;
  name: string;
  isActive: boolean;
}

interface NewChildForm {
  rollNumber: string;
  fullName: string;
  guardianName: string;
  guardianPhone: string;
  classId: number | '';
  feeStructureId: number | '';
  monthlyFee: string;
  feeEffectiveFrom: string;
}

const EMPTY_NEW_CHILD: NewChildForm = {
  rollNumber: '',
  fullName: '',
  guardianName: '',
  guardianPhone: '',
  classId: '',
  feeStructureId: '',
  monthlyFee: '',
  feeEffectiveFrom: new Date().toISOString().slice(0, 7) + '-01',
};

interface FamilyForm {
  guardianName: string;
  guardianPhone: string;
  address: string;
  notes: string;
}

const EMPTY_FORM: FamilyForm = {
  guardianName: '',
  guardianPhone: '',
  address: '',
  notes: '',
};

export function FamiliesPage() {
  const [families, setFamilies] = useState<Family[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [selectedFamily, setSelectedFamily] = useState<Family | null>(null);
const [availableStudents, setAvailableStudents] = useState<StudentOption[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [feeStructures, setFeeStructures] = useState<import('@school/shared').FeeStructure[]>([]);
  const [existingChildFee, setExistingChildFee] = useState<Record<number, import('@school/shared').StudentFeeAssignment | null>>({});
  const [showAddExisting, setShowAddExisting] = useState(false);
  const [showAddNewChild, setShowAddNewChild] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState<number | ''>('');
  const [newChild, setNewChild] = useState<NewChildForm>(EMPTY_NEW_CHILD);
  const [childSaving, setChildSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<FamilyForm>(EMPTY_FORM);

  const [showFamilyPayment, setShowFamilyPayment] = useState(false);
  const [familyPaymentAmount, setFamilyPaymentAmount] = useState('');
  const [familyPaymentMethod, setFamilyPaymentMethod] =
    useState<import('@school/shared').FeePaymentMethod>('cash');
  const [familyPaymentDate, setFamilyPaymentDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [familyPaymentNotes, setFamilyPaymentNotes] = useState('');
  const [familyPaymentSaving, setFamilyPaymentSaving] = useState(false);

  interface FamilyPaymentFee {
    studentFeeId: number;
    studentId: number;
    studentName: string;
    rollNumber: string;
    className: string;
    feePeriod: string;
    amountDue: number;
    amountPaid: number;
    totalPayable: number;
    totalRemaining: number;
    appliedFine: number;
    fineWaivedAmount: number;
    dueDate: string | null;
  }

  interface FamilyPaymentAllocation {
    studentFeeId: number;
    studentId: number;
    studentName: string;
    rollNumber: string;
    className: string;
    feePeriod: string;
    outstanding: number;
    allocation: number;
    remainingAfterPayment: number;
    dueDate: string | null;
  }

  const [familyPaymentFees, setFamilyPaymentFees] =
    useState<FamilyPaymentFee[]>([]);
  const [familyPaymentLoading, setFamilyPaymentLoading] = useState(false);
  const [familyPaymentAllocations, setFamilyPaymentAllocations] =
    useState<FamilyPaymentAllocation[]>([]);


  async function loadFamilies(search = query) {
    setLoading(true);
    setError(null);

    const qs = new URLSearchParams();
    if (search.trim()) qs.set('q', search.trim());

    const result = await api.get<Family[]>(
      `/families${qs.toString() ? `?${qs.toString()}` : ''}`
    );

    if (result.success && result.data) {
      setFamilies(result.data);
    } else {
      setError(result.error ?? 'Failed to load families');
    }

    setLoading(false);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadFamilies(query);
    }, 250);

    return () => window.clearTimeout(timer);
  }, [query]);

  function showNotice(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(null), 3500);
  }

  function openCreate() {
    setError(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  }

  async function handleFamilyPaymentSubmit() {
    if (!selectedFamily) {
      setError('No family selected.');
      return;
    }

    const amount = Number(familyPaymentAmount);
    const validationError = getFamilyPaymentValidation(amount);

    if (validationError) {
      setError(validationError);
      return;
    }

    setFamilyPaymentSaving(true);
    setError('');
    setNotice('');

    const result = await familyPaymentsApi.create({
      familyId: selectedFamily.id,
      paymentDate: familyPaymentDate,
      paymentMethod: familyPaymentMethod,
      items: familyPaymentAllocations.map(item => ({
        studentFeeId: item.studentFeeId,
        amount: item.allocation,
      })),
      notes: familyPaymentNotes.trim() || undefined,
    });

    setFamilyPaymentSaving(false);

    if (!result.success || !result.data) {
      setError(result.error ?? 'Failed to record family payment.');
      return;
    }

    setNotice(
      `Family payment recorded successfully. Receipt #${result.data.receiptNumber}.`
    );
    setFamilyPaymentAmount('');
    setFamilyPaymentAllocations([]);
    setFamilyPaymentNotes('');
    await loadFamilyPaymentFees(selectedFamily);
  }

  function getFamilyPaymentValidation(amount: number) {
    const totalOutstanding = familyPaymentFees.reduce(
      (sum, fee) => sum + fee.totalRemaining,
      0
    );

    if (!Number.isInteger(amount) || amount <= 0) {
      return 'Enter a valid payment amount.';
    }

    if (familyPaymentFees.length === 0) {
      return 'No outstanding fees are available for this family.';
    }

    if (amount > totalOutstanding) {
      return `Payment amount cannot exceed total outstanding of Rs. ${totalOutstanding.toLocaleString()}.`;
    }

    if (familyPaymentAllocations.length === 0) {
      return 'Payment allocation could not be calculated.';
    }

    return null;
  }

  function handleFamilyPaymentAmountChange(value: string) {
    setFamilyPaymentAmount(value);

    const amount = Number(value);

    if (!Number.isInteger(amount) || amount <= 0) {
      setFamilyPaymentAllocations([]);
      return;
    }

    calculateFamilyPaymentAllocations(amount);
  }

  function calculateFamilyPaymentAllocations(amount: number) {
    if (!Number.isInteger(amount) || amount <= 0) {
      setFamilyPaymentAllocations([]);
      return;
    }

    let remainingPayment = amount;

    const allocations: FamilyPaymentAllocation[] = [];

    for (const fee of familyPaymentFees) {
      if (remainingPayment <= 0) {
        break;
      }

      const outstanding = Math.max(0, fee.totalRemaining);

      if (outstanding <= 0) {
        continue;
      }

      const allocation = Math.min(
        remainingPayment,
        outstanding
      );

      if (allocation <= 0) {
        continue;
      }

      allocations.push({
        studentFeeId: fee.studentFeeId,
        studentId: fee.studentId,
        studentName: fee.studentName,
        rollNumber: fee.rollNumber,
        className: fee.className,
        feePeriod: fee.feePeriod,
        outstanding,
        allocation,
        remainingAfterPayment: outstanding - allocation,
        dueDate: fee.dueDate,
      });

      remainingPayment -= allocation;
    }

    setFamilyPaymentAllocations(allocations);
  }

  async function loadFamilyPaymentFees(family: Family) {
    setFamilyPaymentLoading(true);
    setFamilyPaymentFees([]);
    setFamilyPaymentAllocations([]);

    try {
      const result = await familyPaymentsApi.outstanding(family.id);

      if (!result.success || !result.data) {
        setError(result.error ?? 'Unable to load family outstanding fees');
        return;
      }

      const fees: FamilyPaymentFee[] = result.data.children.flatMap(child =>
        child.fees.map(fee => ({
          studentFeeId: fee.studentFeeId,
          studentId: child.studentId,
          studentName: child.studentName,
          rollNumber: child.rollNumber,
          className: child.className,
          feePeriod: fee.feePeriod,
          amountDue: fee.amountDue,
          amountPaid: fee.amountPaid,
          totalPayable: fee.totalPayable,
          totalRemaining: fee.remaining,
          appliedFine: fee.effectiveFine,
          fineWaivedAmount: fee.fineWaivedAmount,
          dueDate: fee.dueDate,
        }))
      );

      fees.sort((a, b) => {
        const periodCompare = a.feePeriod.localeCompare(b.feePeriod);
        if (periodCompare !== 0) return periodCompare;

        return a.studentName.localeCompare(b.studentName);
      });

      setFamilyPaymentFees(fees);
    } catch {
      setError('Unable to load family outstanding fees');
    } finally {
      setFamilyPaymentLoading(false);
    }
  }

  async function openFamily(familyId: number) {
    setError('');
    setSelectedFamily(null);

    try {
      const result = await api.get<Family>(`/families/${familyId}`);
      if (!result.success || !result.data) {
        setError('Unable to load family');
        return;
      }

      setSelectedFamily(result.data);
      setSelectedStudentId('');
      setFamilyPaymentFees([]);
      setFamilyPaymentAllocations([]);
      setFamilyPaymentAmount('');
      setFamilyPaymentMethod('cash');
      setFamilyPaymentDate(new Date().toISOString().slice(0, 10));
      setFamilyPaymentNotes('');
      setShowFamilyPayment(false);
      setNewChild({
        ...EMPTY_NEW_CHILD,
        guardianName: result.data.guardianName,
        guardianPhone: result.data.guardianPhone || '',
        feeStructureId: '',
        monthlyFee: '',
        feeEffectiveFrom: new Date().toISOString().slice(0, 7) + '-01',
      });
      setShowAddExisting(false);
      setShowAddNewChild(false);

      const [studentResult, classResult, feeResult] = await Promise.all([
        studentsApi.list(),
        classesApi.list(),
        feesApi.listStructures(),
      ]);

      if (studentResult.success && studentResult.data) {
        setAvailableStudents(studentResult.data as StudentOption[]);
      }

      if (classResult.success && classResult.data) {
        setClasses(classResult.data as ClassOption[]);
      }

      if (feeResult.success && feeResult.data) {
        setFeeStructures(feeResult.data);
      }

      const feeMap: Record<number, import('@school/shared').StudentFeeAssignment | null> = {};
      const activeChildren = result.data.children.filter(child => child.isActive);

      await Promise.all(
        activeChildren.map(async child => {
          const assignmentResult = await studentFeeAssignmentsApi.list({
            studentId: child.id,
            activeOnly: true,
          });

          feeMap[child.id] =
            assignmentResult.success && assignmentResult.data?.length
              ? assignmentResult.data[0]
              : null;
        })
      );

      setExistingChildFee(feeMap);
    } catch {
      setError('Unable to load family');
    }
  }

  async function refreshSelectedFamily() {
    if (!selectedFamily) return;

    const result = await api.get<Family>(`/families/${selectedFamily.id}`);
    if (result.success && result.data) {
      setSelectedFamily(result.data);
      setFamilies(prev =>
        prev.map(f => f.id === result.data!.id ? result.data! : f)
      );

      const feeMap: Record<number, import('@school/shared').StudentFeeAssignment | null> = {};
      await Promise.all(
        result.data.children
          .filter(child => child.isActive)
          .map(async child => {
            const assignmentResult = await studentFeeAssignmentsApi.list({
              studentId: child.id,
              activeOnly: true,
            });

            feeMap[child.id] =
              assignmentResult.success && assignmentResult.data?.length
                ? assignmentResult.data[0]
                : null;
          })
      );

      setExistingChildFee(feeMap);
    }
  }

  async function handleAddExistingChild() {
    if (!selectedFamily || !selectedStudentId) {
      setError('Please select a student');
      return;
    }

    setChildSaving(true);
    setError('');

    try {
      const result = await api.post<Family>(
        `/families/${selectedFamily.id}/students`,
        { studentId: Number(selectedStudentId) }
      );

      if (!result.success) {
        setError('Unable to link child');
        return;
      }

      await refreshSelectedFamily();
      setSelectedStudentId('');
      setShowAddExisting(false);
      setNotice('Existing student linked to family successfully.');
    } catch {
      setError('Unable to link child');
    } finally {
      setChildSaving(false);
    }
  }

  async function handleAddNewChild() {
    if (
      !selectedFamily ||
      !newChild.rollNumber.trim() ||
      !newChild.fullName.trim() ||
      !newChild.guardianName.trim() ||
      !newChild.classId
    ) {
      setError('Roll number, student name, guardian name and class are required.');
      return;
    }

    if (newChild.feeStructureId === '') {
      setError('Select a fee type for this child.');
      return;
    }

    const monthlyFee = Number(newChild.monthlyFee);
    if (!Number.isFinite(monthlyFee) || monthlyFee < 0 || !Number.isInteger(monthlyFee)) {
      setError('Enter a valid monthly fee amount.');
      return;
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(newChild.feeEffectiveFrom)) {
      setError('Enter a valid fee effective date.');
      return;
    }

    setChildSaving(true);
    setError('');

    try {
      const result = await studentsApi.create({
        rollNumber: newChild.rollNumber.trim(),
        fullName: newChild.fullName.trim(),
        guardianName: newChild.guardianName.trim(),
        guardianPhone: newChild.guardianPhone.trim() || undefined,
        classId: Number(newChild.classId),
        familyId: selectedFamily.id,
      });

      if (!result.success || !result.data) {
        setError(result.error ?? 'Unable to add child');
        return;
      }

      const assignmentResult = await studentFeeAssignmentsApi.create({
        studentId: result.data.id,
        feeStructureId: newChild.feeStructureId as number,
        amount: Number(newChild.monthlyFee),
        effectiveFrom: newChild.feeEffectiveFrom,
      });

      if (!assignmentResult.success) {
        setError(
          `Child was added, but fee setup failed: ${assignmentResult.error ?? 'Unknown error'}.`
        );
        await refreshSelectedFamily();
        return;
      }

      await refreshSelectedFamily();
      setAvailableStudents(prev => [
        ...prev,
        result.data as StudentOption,
      ]);
      setNewChild({
        ...EMPTY_NEW_CHILD,
        guardianName: selectedFamily.guardianName,
        guardianPhone: selectedFamily.guardianPhone || '',
      });
      setShowAddNewChild(false);
      setNotice('New child added successfully.');
    } catch {
      setError('Unable to add child');
    } finally {
      setChildSaving(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();

    if (!form.guardianName.trim()) {
      setError('Guardian / parent name is required');
      return;
    }

    setSaving(true);
    setError(null);

    const result = await api.post<Family>('/families', {
      guardianName: form.guardianName.trim(),
      guardianPhone: form.guardianPhone.trim() || undefined,
      address: form.address.trim() || undefined,
      notes: form.notes.trim() || undefined,
    });

    setSaving(false);

    if (result.success) {
      setShowModal(false);
      setForm(EMPTY_FORM);
      showNotice('Family created successfully');
      await loadFamilies(query);

      if (result.data) {
        setSelectedFamily(result.data);
      }
    } else {
      setError(result.error ?? 'Failed to create family');
    }
  }

  function childStatus(child: FamilyChild) {
    return child.isActive ? s.badgeGreen : s.badgeGrey;
  }

  return (
    <div>
      <div style={s.between}>
        <div>
          <h1 style={s.pageTitle}>Families</h1>
          <p style={s.muted}>
            Manage parents, guardians and all children belonging to each family.
          </p>
        </div>

        <button type="button" style={s.btn} onClick={openCreate}>
          + Add Family
        </button>
      </div>

      <div style={{ ...s.card, marginBottom: 16 }}>
        <div style={{ ...s.field, maxWidth: 620 }}>
          <label style={s.label} htmlFor="familySearch">
            Search families
          </label>
          <input
            id="familySearch"
            style={s.input}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Student name, roll no, guardian name or phone..."
          />
        </div>

        <p style={{ ...s.muted, margin: '10px 0 0' }}>
          {families.length} family{families.length === 1 ? '' : 'ies'} found
        </p>
      </div>

      {error && <p style={s.errText} role="alert">{error}</p>}
      {notice && <p style={s.okText}>{notice}</p>}

      {loading ? (
        <p style={s.spinner}>Loading families...</p>
      ) : families.length === 0 ? (
        <div style={{ ...s.card, ...s.empty }}>
          No families found.
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(310px, 1fr))',
            gap: 16,
          }}
        >
          {families.map(family => (
            <div
              key={family.id}
              style={{
                ...s.card,
                margin: 0,
                cursor: 'pointer',
                transition: 'transform 0.15s ease, box-shadow 0.15s ease',
              }}
              onClick={() => void openFamily(family.id)}
            >
              <div style={s.between}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '1.05rem', color: '#123B5D' }}>
                    {family.guardianName}
                  </h2>
                  <p style={{ ...s.muted, margin: '5px 0 0' }}>
                    {family.guardianPhone || 'No phone number'}
                  </p>
                </div>

                <span style={family.isActive ? s.badgeGreen : s.badgeGrey}>
                  {family.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>

              <div
                style={{
                  marginTop: 16,
                  paddingTop: 14,
                  borderTop: '1px solid #D9E2EC',
                }}
              >
                <div style={{ fontWeight: 700, marginBottom: 10 }}>
                  {family.childrenCount} Child{family.childrenCount === 1 ? '' : 'ren'}
                </div>

                {family.children.map(child => (
                  <div
                    key={child.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 10,
                      padding: '9px 0',
                      borderBottom: '1px solid #eef2f6',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600 }}>{child.fullName}</div>
                      <div style={{ ...s.muted, fontSize: 13 }}>
                        {child.rollNumber} · {child.className}
                      </div>
                    </div>

                    <span style={childStatus(child)}>
                      {child.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: 14 }}>
                <button
                  type="button"
                  style={{ ...s.btnSecondary, ...s.btnSmall }}
                  onClick={e => {
                    e.stopPropagation();
                    void openFamily(family.id);
                  }}
                >
                  View Family
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedFamily && (
        <div style={s.modal} onClick={() => setSelectedFamily(null)}>
          <div
            style={{
              ...s.modalCard,
              maxWidth: 760,
              width: 'calc(100% - 32px)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={s.between}>
              <div>
                <h2 style={s.modalTitle}>{selectedFamily.guardianName}</h2>
                <p style={s.muted}>
                  {selectedFamily.guardianPhone || 'No phone number saved'}
                </p>
              </div>

              <span style={selectedFamily.isActive ? s.badgeGreen : s.badgeGrey}>
                {selectedFamily.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: 12,
                marginTop: 18,
              }}
            >
              <div style={{ ...s.card, margin: 0, padding: 14 }}>
                <div style={s.muted}>Children</div>
                <strong>{selectedFamily.childrenCount}</strong>
              </div>

              <div style={{ ...s.card, margin: 0, padding: 14 }}>
                <div style={s.muted}>Phone</div>
                <strong>{selectedFamily.guardianPhone || '—'}</strong>
              </div>

              <div style={{ ...s.card, margin: 0, padding: 14 }}>
                <div style={s.muted}>Address</div>
                <strong>{selectedFamily.address || '—'}</strong>
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                gap: 8,
                flexWrap: 'wrap',
                marginTop: 20,
              }}
            >
              <button
                type="button"
                style={{ ...s.btnSecondary, ...s.btnSmall }}
                onClick={() => {
                  setShowAddExisting(v => !v);
                  setShowAddNewChild(false);
                  setError('');
                }}
              >
                + Add Existing Child
              </button>

              <button
                type="button"
                style={{ ...s.btnPrimary, ...s.btnSmall }}
                onClick={() => {
                  setShowAddNewChild(v => !v);
                  setShowAddExisting(false);
                  setError('');
                }}
              >
                + Add New Child
              </button>
            </div>

            {showAddExisting && (
              <div style={{ ...s.card, margin: '12px 0 0', padding: 14 }}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <select
                    value={selectedStudentId}
                    onChange={e =>
                      setSelectedStudentId(
                        e.target.value ? Number(e.target.value) : ''
                      )
                    }
                    style={{ ...s.input, flex: 1, minWidth: 220 }}
                  >
                    <option value="">Select existing student</option>
                    {availableStudents
                      .filter(
                        student =>
                          student.isActive &&
                          !selectedFamily.children.some(
                            child => child.id === student.id
                          )
                      )
                      .map(student => (
                        <option key={student.id} value={student.id}>
                          {student.fullName} — {student.rollNumber} — {student.className}
                        </option>
                      ))}
                  </select>

                  <button
                    type="button"
                    style={{ ...s.btnPrimary, ...s.btnSmall }}
                    disabled={childSaving || !selectedStudentId}
                    onClick={() => void handleAddExistingChild()}
                  >
                    {childSaving ? 'Linking...' : 'Link Child'}
                  </button>
                </div>
              </div>
            )}

            {showAddNewChild && (
              <div style={{ ...s.card, margin: '12px 0 0', padding: 16 }}>
                <div style={{ fontWeight: 700, color: '#123B5D', marginBottom: 4 }}>
                  Add New Child
                </div>
                <div style={{ ...s.muted, fontSize: 12, marginBottom: 14 }}>
                  The child will be added to this family and receive an individual recurring fee plan.
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                    gap: 10,
                  }}
                >
                  <input
                    placeholder="Roll Number"
                    value={newChild.rollNumber}
                    onChange={e =>
                      setNewChild({ ...newChild, rollNumber: e.target.value })
                    }
                    style={s.input}
                  />

                  <input
                    placeholder="Student Name"
                    value={newChild.fullName}
                    onChange={e =>
                      setNewChild({ ...newChild, fullName: e.target.value })
                    }
                    style={s.input}
                  />

                  <input
                    placeholder="Guardian Name"
                    value={newChild.guardianName}
                    onChange={e =>
                      setNewChild({ ...newChild, guardianName: e.target.value })
                    }
                    style={s.input}
                  />

                  <input
                    placeholder="Guardian Phone"
                    value={newChild.guardianPhone}
                    onChange={e =>
                      setNewChild({ ...newChild, guardianPhone: e.target.value })
                    }
                    style={s.input}
                  />

                  <select
                    value={newChild.classId}
                    onChange={e => {
                      const classId = e.target.value ? Number(e.target.value) : '';
                      const firstStructure = feeStructures.find(
                        fs => fs.isActive && fs.classId === classId
                      );

                      setNewChild({
                        ...newChild,
                        classId,
                        feeStructureId: firstStructure?.id ?? '',
                        monthlyFee: firstStructure ? String(firstStructure.amount) : '',
                      });
                    }}
                    style={s.input}
                  >
                    <option value="">Select Class</option>
                    {classes
                      .filter(cls => cls.isActive)
                      .map(cls => (
                        <option key={cls.id} value={cls.id}>
                          {cls.name}
                        </option>
                      ))}
                  </select>
                </div>

                <div
                  style={{
                    marginTop: 14,
                    padding: 14,
                    border: '1px solid #D9E2EC',
                    borderRadius: 10,
                    background: '#F8FAFC',
                  }}
                >
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>
                    Fee Plan
                  </div>
                  <div style={{ ...s.muted, fontSize: 12, marginBottom: 12 }}>
                    Set this child?s actual monthly fee once. The system will create monthly fee history automatically.
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
                      gap: 10,
                    }}
                  >
                    <select
                      value={newChild.feeStructureId}
                      onChange={e => {
                        const feeStructureId =
                          e.target.value ? Number(e.target.value) : '';
                        const selected = feeStructures.find(
                          fs => fs.id === feeStructureId
                        );

                        setNewChild({
                          ...newChild,
                          feeStructureId,
                          monthlyFee: selected ? String(selected.amount) : '',
                        });
                      }}
                      style={s.input}
                    >
                      <option value="">Select Fee Type</option>
                      {feeStructures
                        .filter(
                          fs =>
                            fs.isActive &&
                            fs.classId === newChild.classId
                        )
                        .map(fs => (
                          <option key={fs.id} value={fs.id}>
                            {fs.feeName}
                          </option>
                        ))}
                    </select>

                    <input
                      value={
                        feeStructures.find(
                          fs => fs.id === newChild.feeStructureId
                        )
                          ? `Standard: Rs. ${feeStructures
                              .find(fs => fs.id === newChild.feeStructureId)!
                              .amount.toLocaleString()}`
                          : 'Standard fee'
                      }
                      readOnly
                      style={s.input}
                    />

                    <input
                      type="number"
                      min="0"
                      step="1"
                      placeholder="Actual Monthly Fee"
                      value={newChild.monthlyFee}
                      onChange={e =>
                        setNewChild({
                          ...newChild,
                          monthlyFee: e.target.value,
                        })
                      }
                      style={s.input}
                    />

                    <input
                      type="date"
                      value={newChild.feeEffectiveFrom}
                      onChange={e =>
                        setNewChild({
                          ...newChild,
                          feeEffectiveFrom: e.target.value,
                        })
                      }
                      style={s.input}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                  <button
                    type="button"
                    style={{ ...s.btnPrimary, ...s.btnSmall }}
                    disabled={childSaving}
                    onClick={() => void handleAddNewChild()}
                  >
                    {childSaving ? 'Adding...' : 'Add Child'}
                  </button>

                  <button
                    type="button"
                    style={{ ...s.btnSecondary, ...s.btnSmall }}
                    onClick={() => setShowAddNewChild(false)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <h3 style={{ margin: '22px 0 10px', color: '#123B5D' }}>
              Children
            </h3>

            <div style={s.tableWrap}>
              <table style={s.table}>
                <thead>
                  <tr>
                    <th style={s.th}>Roll No</th>
                    <th style={s.th}>Student</th>
                    <th style={s.th}>Class</th>
                    <th style={s.th}>Monthly Fee</th>
                    <th style={s.th}>Phone</th>
                    <th style={s.th}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedFamily.children.map(child => (
                    <tr key={child.id}>
                      <td style={s.td}>{child.rollNumber}</td>
                      <td style={s.td}>{child.fullName}</td>
                      <td style={s.td}>{child.className}</td>
                      <td style={s.td}>{child.guardianPhone || '—'}</td>
                      <td style={s.td}>
                        <span style={childStatus(child)}>
                          {child.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div
              style={{
                ...s.card,
                marginTop: 18,
                padding: 16,
              }}
            >
              <div style={s.between}>
                <div>
                  <h3 style={{ margin: 0, color: '#123B5D' }}>
                    Receive Family Payment
                  </h3>
                  <p style={{ ...s.muted, margin: '5px 0 0' }}>
                    One payment can be allocated across this family's outstanding fees.
                  </p>
                </div>

                <button
                  type="button"
                  style={{ ...s.btnPrimary, ...s.btnSmall }}
                  disabled={familyPaymentLoading}
                  onClick={() => {
                    setError('');
                    setShowFamilyPayment(true);
                    void loadFamilyPaymentFees(selectedFamily);
                  }}
                >
                  {familyPaymentLoading ? 'Loading...' : 'Receive Payment'}
                </button>
              </div>

              {showFamilyPayment && (
                <div
                  style={{
                    marginTop: 16,
                    paddingTop: 16,
                    borderTop: '1px solid #D9E2EC',
                  }}
                >
                  {familyPaymentLoading ? (
                    <p style={s.muted}>Loading outstanding fees...</p>
                  ) : familyPaymentFees.length === 0 ? (
                    <div
                      style={{
                        padding: 14,
                        border: '1px solid #D9E2EC',
                        borderRadius: 10,
                        background: '#F8FAFC',
                      }}
                    >
                      <strong>No outstanding fees found.</strong>
                      <p style={{ ...s.muted, margin: '5px 0 0' }}>
                        All active children currently have no outstanding fee balance.
                      </p>
                    </div>
                  ) : (
                    <>
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                          gap: 10,
                        }}
                      >
                        <div style={s.field}>
                          <label style={s.label} htmlFor="familyPaymentAmount">
                            Payment Amount *
                          </label>
                          <input
                            id="familyPaymentAmount"
                            type="number"
                            min="1"
                            step="1"
                            value={familyPaymentAmount}
                            onChange={e =>
                              handleFamilyPaymentAmountChange(e.target.value)
                            }
                            placeholder="Enter amount"
                            style={s.input}
                          />
                        </div>

                        <div style={s.field}>
                          <label style={s.label} htmlFor="familyPaymentMethod">
                            Payment Method
                          </label>
                          <select
                            id="familyPaymentMethod"
                            value={familyPaymentMethod}
                            onChange={e =>
                              setFamilyPaymentMethod(
                                e.target.value as import('@school/shared').FeePaymentMethod
                              )
                            }
                            style={s.input}
                          >
                            <option value="cash">Cash</option>
                            <option value="bank">Bank</option>
                            <option value="online">Online</option>
                            <option value="other">Other</option>
                          </select>
                        </div>

                        <div style={s.field}>
                          <label style={s.label} htmlFor="familyPaymentDate">
                            Payment Date
                          </label>
                          <input
                            id="familyPaymentDate"
                            type="date"
                            value={familyPaymentDate}
                            onChange={e => setFamilyPaymentDate(e.target.value)}
                            style={s.input}
                          />
                        </div>
                      </div>

                      <div style={{ ...s.field, marginTop: 10 }}>
                        <label style={s.label} htmlFor="familyPaymentNotes">
                          Reference / Notes
                        </label>
                        <textarea
                          id="familyPaymentNotes"
                          value={familyPaymentNotes}
                          onChange={e => setFamilyPaymentNotes(e.target.value)}
                          placeholder="Optional payment reference or note"
                          style={{
                            ...s.input,
                            minHeight: 70,
                            resize: 'vertical',
                          }}
                        />
                      </div>

                      <div
                        style={{
                          marginTop: 14,
                          padding: 14,
                          border: '1px solid #D9E2EC',
                          borderRadius: 10,
                          background: '#F8FAFC',
                        }}
                      >
                        <div style={s.between}>
                          <strong>Outstanding Fees</strong>
                          <strong>
                            Rs. {familyPaymentFees
                              .reduce((sum, fee) => sum + fee.totalRemaining, 0)
                              .toLocaleString()}
                          </strong>
                        </div>

                        <div style={{ ...s.tableWrap, marginTop: 10 }}>
                          <table style={s.table}>
                            <thead>
                              <tr>
                                <th style={s.th}>Period</th>
                                <th style={s.th}>Student</th>
                                <th style={s.th}>Class</th>
                                <th style={s.th}>Due</th>
                                <th style={s.th}>Fine</th>
                                <th style={s.th}>Outstanding</th>
                              </tr>
                            </thead>
                            <tbody>
                              {familyPaymentFees.map(fee => (
                                <tr key={fee.studentFeeId}>
                                  <td style={s.td}>{fee.feePeriod}</td>
                                  <td style={s.td}>
                                    {fee.studentName}
                                    <div style={{ ...s.muted, fontSize: 12 }}>
                                      {fee.rollNumber}
                                    </div>
                                  </td>
                                  <td style={s.td}>{fee.className}</td>
                                  <td style={s.td}>
                                    Rs. {fee.totalPayable.toLocaleString()}
                                  </td>
                                  <td style={s.td}>
                                    Rs. {fee.appliedFine.toLocaleString()}
                                  </td>
                                  <td style={s.td}>
                                    <strong>
                                      Rs. {fee.totalRemaining.toLocaleString()}
                                    </strong>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {familyPaymentAllocations.length > 0 && (
                        <div
                          style={{
                            marginTop: 14,
                            padding: 14,
                            border: '1px solid #D9E2EC',
                            borderRadius: 10,
                          }}
                        >
                          <div style={s.between}>
                            <strong>Payment Allocation Review</strong>
                            <strong>
                              Rs. {familyPaymentAllocations
                                .reduce((sum, item) => sum + item.allocation, 0)
                                .toLocaleString()}
                            </strong>
                          </div>

                          <p style={{ ...s.muted, fontSize: 12, margin: '5px 0 10px' }}>
                            Automatic allocation uses the oldest outstanding fee first.
                          </p>

                          <div style={s.tableWrap}>
                            <table style={s.table}>
                              <thead>
                                <tr>
                                  <th style={s.th}>Period</th>
                                  <th style={s.th}>Student</th>
                                  <th style={s.th}>Outstanding</th>
                                  <th style={s.th}>Allocate</th>
                                  <th style={s.th}>Remaining</th>
                                </tr>
                              </thead>
                              <tbody>
                                {familyPaymentAllocations.map(item => (
                                  <tr key={item.studentFeeId}>
                                    <td style={s.td}>{item.feePeriod}</td>
                                    <td style={s.td}>
                                      {item.studentName}
                                      <div style={{ ...s.muted, fontSize: 12 }}>
                                        {item.rollNumber} ? {item.className}
                                      </div>
                                    </td>
                                    <td style={s.td}>
                                      Rs. {item.outstanding.toLocaleString()}
                                    </td>
                                    <td style={s.td}>
                                      <strong>
                                        Rs. {item.allocation.toLocaleString()}
                                      </strong>
                                    </td>
                                    <td style={s.td}>
                                      Rs. {item.remainingAfterPayment.toLocaleString()}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {familyPaymentAllocations.length > 0 && (
                        <div
                          style={{
                            marginTop: 14,
                            padding: 14,
                            border: '1px solid #D9E2EC',
                            borderRadius: 10,
                            background: '#FFFFFF',
                          }}
                        >
                          {(() => {
                            const enteredAmount = Number(familyPaymentAmount) || 0;
                            const allocatedAmount =
                              familyPaymentAllocations.reduce(
                                (sum, item) => sum + item.allocation,
                                0
                              );
                            const validationError =
                              getFamilyPaymentValidation(enteredAmount);

                            return (
                              <>
                                <div
                                  style={{
                                    display: 'grid',
                                    gridTemplateColumns:
                                      'repeat(auto-fit, minmax(160px, 1fr))',
                                    gap: 10,
                                  }}
                                >
                                  <div>
                                    <div style={s.muted}>Entered</div>
                                    <strong>
                                      Rs. {enteredAmount.toLocaleString()}
                                    </strong>
                                  </div>

                                  <div>
                                    <div style={s.muted}>Allocated</div>
                                    <strong>
                                      Rs. {allocatedAmount.toLocaleString()}
                                    </strong>
                                  </div>

                                  <div>
                                    <div style={s.muted}>Unallocated</div>
                                    <strong>
                                      Rs.{' '}
                                      {Math.max(
                                        0,
                                        enteredAmount - allocatedAmount
                                      ).toLocaleString()}
                                    </strong>
                                  </div>
                                </div>

                                {validationError && (
                                  <p
                                    style={{
                                      ...s.errText,
                                      margin: '12px 0 0',
                                    }}
                                    role="alert"
                                  >
                                    {validationError}
                                  </p>
                                )}

                                <div
                                  style={{
                                    display: 'flex',
                                    gap: 8,
                                    flexWrap: 'wrap',
                                    marginTop: 14,
                                  }}
                                >
                                  <button
                                    type="button"
                                    style={s.btnPrimary}
                                    disabled={
                                      familyPaymentSaving ||
                                      Boolean(validationError)
                                    }
                                    onClick={() =>
                                      void handleFamilyPaymentSubmit()
                                    }
                                  >
                                    {familyPaymentSaving
                                      ? 'Saving Payment...'
                                      : 'Confirm Family Payment'}
                                  </button>

                                  <button
                                    type="button"
                                    style={s.btnSecondary}
                                    disabled={familyPaymentSaving}
                                    onClick={() => {
                                      setFamilyPaymentAmount('');
                                      setFamilyPaymentAllocations([]);
                                      setFamilyPaymentNotes('');
                                      setShowFamilyPayment(false);
                                    }}
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </>
                            );
                          })()}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>

            {selectedFamily.notes && (
              <div style={{ ...s.card, marginTop: 16 }}>
                <strong>Notes</strong>
                <p style={{ ...s.muted, whiteSpace: 'pre-wrap' }}>
                  {selectedFamily.notes}
                </p>
              </div>
            )}

            <div style={s.modalActions}>
              <button
                type="button"
                style={s.btnSecondary}
                onClick={() => setSelectedFamily(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div style={s.modal} onClick={() => setShowModal(false)}>
          <div style={s.modalCard} onClick={e => e.stopPropagation()}>
            <h2 style={s.modalTitle}>Add Family</h2>
            <p style={s.muted}>
              Create the parent/guardian record first. Children can be linked afterward.
            </p>

            <form onSubmit={handleCreate} style={s.form}>
              <div style={s.field}>
                <label style={s.label} htmlFor="familyGuardian">
                  Guardian / Parent Name *
                </label>
                <input
                  id="familyGuardian"
                  style={s.input}
                  value={form.guardianName}
                  onChange={e => setForm({ ...form, guardianName: e.target.value })}
                  required
                />
              </div>

              <div style={s.field}>
                <label style={s.label} htmlFor="familyPhone">
                  Phone Number
                </label>
                <input
                  id="familyPhone"
                  style={s.input}
                  value={form.guardianPhone}
                  onChange={e => setForm({ ...form, guardianPhone: e.target.value })}
                  placeholder="03XXXXXXXXX"
                />
              </div>

              <div style={s.field}>
                <label style={s.label} htmlFor="familyAddress">
                  Address
                </label>
                <input
                  id="familyAddress"
                  style={s.input}
                  value={form.address}
                  onChange={e => setForm({ ...form, address: e.target.value })}
                />
              </div>

              <div style={s.field}>
                <label style={s.label} htmlFor="familyNotes">
                  Notes
                </label>
                <textarea
                  id="familyNotes"
                  style={{ ...s.input, minHeight: 90, resize: 'vertical' }}
                  value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })}
                />
              </div>

              {error && <p style={s.errText} role="alert">{error}</p>}

              <div style={s.modalActions}>
                <button
                  type="button"
                  style={s.btnSecondary}
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </button>

                <button type="submit" style={s.btn} disabled={saving}>
                  {saving ? 'Saving...' : 'Create Family'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
