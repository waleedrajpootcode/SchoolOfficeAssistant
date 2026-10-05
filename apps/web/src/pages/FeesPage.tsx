import React, { useEffect, useMemo, useState } from 'react';
import type {
  FeeStructure,
  StudentFee,
  FeePayment,
  FeeSummary,
  StudentSummary,
  ClassSummary,
  FeeRule,
  FamilyPaymentResult,
} from '@school/shared';

import { feesApi } from '../api/fees.js';
import { api } from '../api/client.js';
import { studentsApi } from '../api/students.js';
import { classesApi } from '../api/classes.js';
import { feeRulesApi } from '../api/feeRules.js';
import { familyPaymentsApi } from '../api/familyPayments.js';
import { s, colors } from '../styles/shared.js';

type SchoolSettings = {
  schoolName: string;
  schoolAddress: string | null;
  phone: string | null;
  email: string | null;
  academicYear: string | null;
};

function formatAmount(amount: number): string {
  return `Rs. ${amount.toLocaleString()}`;
}

type FeeDisplayStatus = StudentFee['status'] | 'overdue';

function statusStyle(status: FeeDisplayStatus) {
  if (status === 'paid') {
    return { ...s.badge, ...s.badgeGreen };
  }

  if (status === 'partial') {
    return { ...s.badge, ...s.badgeAmber };
  }

  if (status === 'overdue') {
    return { ...s.badge, ...s.badgeRed };
  }

  return { ...s.badge, ...s.badgeRed };
}

function statusLabel(status: FeeDisplayStatus): string {
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

function previousMonth(period: string): string {
  const [year, month] = period.split('-').map(Number);
  const date = new Date(year, month - 2, 1);

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    '0'
  )}`;
}

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

interface FamilySummary {
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

export function FeesPage() {
  const [structures, setStructures] = useState<FeeStructure[]>([]);
  const [studentFees, setStudentFees] = useState<StudentFee[]>([]);
  const [schoolSettings, setSchoolSettings] =
  useState<SchoolSettings | null>(null);
  const [summary, setSummary] = useState<FeeSummary | null>(null);
  const [students, setStudents] = useState<StudentSummary[]>([]);
  const [classes, setClasses] = useState<ClassSummary[]>([]);
  const [feeRules, setFeeRules] = useState<FeeRule[]>([]);
  const [families, setFamilies] = useState<FamilySummary[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState(currentMonth());
  const [statusFilter, setStatusFilter] =
    useState<'all' | 'paid' | 'partial' | 'unpaid'>('all');
  const [viewMode, setViewMode] =
    useState<'current' | 'history'>('current');
  const [historyPeriod, setHistoryPeriod] = useState('');
  const [historyPeriods, setHistoryPeriods] = useState<string[]>([]);
  const [historyFees, setHistoryFees] = useState<StudentFee[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyPickerYear, setHistoryPickerYear] = useState(
    Number(selectedPeriod.slice(0, 4))
  );

const [fineWaiveForm, setFineWaiveForm] = useState({
  amount: '',
  reason: '',
});
const [studentFeeSearch, setStudentFeeSearch] = useState('');

  const filteredStudentFeeStudents = useMemo(() => {
    const query = studentFeeSearch.trim().toLowerCase();

    if (!query) {
      return students;
    }

    return students.filter((student) =>
      [
        student.fullName,
        student.rollNumber,
        student.guardianName,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query)),
    );
  }, [students, studentFeeSearch]);

  const [selectedFeeId, setSelectedFeeId] = useState<number | null>(null);

  type OutstandingStudentFee = {
    studentFeeId: number;
    feePeriod: string;
    amountDue: number;
    amountPaid: number;
    fineAmount: number;
    fineWaivedAmount: number;
    effectiveFine: number;
    totalPayable: number;
    remaining: number;
    dueDate: string | null;
  };

  type OutstandingStudent = {
    studentId: number;
    studentName: string;
    rollNumber: string;
    guardianName: string;
    totalOutstanding: number;
    fees: OutstandingStudentFee[];
  };

  type OutstandingFamilyChild = {
    studentId: number;
    studentName: string;
    rollNumber: string;
    className: string;
    fees: Array<{
      studentFeeId: number;
      feePeriod: string;
      amountDue: number;
      amountPaid: number;
      fineAmount: number;
      fineWaivedAmount: number;
      effectiveFine: number;
      totalPayable: number;
      remaining: number;
      dueDate: string | null;
    }>;
    totalOutstanding: number;
  };

  type OutstandingFamily = {
    familyId: number;
    children: OutstandingFamilyChild[];
    totalOutstanding: number;
  };

  const [receivePaymentWorkspaceOpen, setReceivePaymentWorkspaceOpen] =
    useState(false);
  const [receivePaymentMode, setReceivePaymentMode] =
    useState<'student' | 'family'>('student');
  const [receivePaymentFamilyId, setReceivePaymentFamilyId] =
    useState<number | null>(null);
  const [receivePaymentFamily, setReceivePaymentFamily] =
    useState<OutstandingFamily | null>(null);
  const [receivePaymentFamilyLoading, setReceivePaymentFamilyLoading] =
    useState(false);
  const [receivePaymentFamilySearch, setReceivePaymentFamilySearch] =
    useState('');
  const [receivePaymentFamilyResult, setReceivePaymentFamilyResult] =
    useState<FamilyPaymentResult | null>(null);

  const [receivePaymentStudentId, setReceivePaymentStudentId] =
    useState<number | null>(null);
  const [receivePaymentStudent, setReceivePaymentStudent] =
    useState<OutstandingStudent | null>(null);
  const [receivePaymentLoading, setReceivePaymentLoading] = useState(false);
  const [receivePaymentAmount, setReceivePaymentAmount] = useState('');
  const [receivePaymentDate, setReceivePaymentDate] = useState(today());
  const [receivePaymentMethod, setReceivePaymentMethod] =
    useState<FeePayment['paymentMethod']>('cash');
  const [receivePaymentNotes, setReceivePaymentNotes] = useState('');
  const [receivePaymentConfirmed, setReceivePaymentConfirmed] = useState(false);
  const [receivePaymentResult, setReceivePaymentResult] = useState<{
    studentId: number;
    studentName: string;
    receiptNumber: string;
    totalAmount: number;
    paymentDate: string;
    paymentMethod: FeePayment['paymentMethod'];
    allocations: Array<{
      paymentId: number;
      studentFeeId: number;
      feePeriod: string;
      amount: number;
    }>;
  } | null>(null);
  const receivePaymentAllocationPreview = useMemo(() => {
    if (!receivePaymentStudent) return [];

    let remainingAmount = Number(receivePaymentAmount) || 0;

    return receivePaymentStudent.fees.map((fee) => {
      const allocation = Math.max(
        0,
        Math.min(fee.remaining, remainingAmount),
      );

      remainingAmount -= allocation;

      return {
        ...fee,
        allocation,
      };
    });
  }, [receivePaymentStudent, receivePaymentAmount]);

  const receivePaymentFamilyAllocationPreview = useMemo(() => {
    if (!receivePaymentFamily) return [];

    const rows = receivePaymentFamily.children.flatMap((child) =>
      child.fees.map((fee) => ({
        ...fee,
        studentId: child.studentId,
        studentName: child.studentName,
        rollNumber: child.rollNumber,
        className: child.className,
        allocation: 0,
      })),
    );

    rows.sort((a, b) => {
      const periodCompare = a.feePeriod.localeCompare(b.feePeriod);
      if (periodCompare !== 0) return periodCompare;

      const rollCompare = a.rollNumber.localeCompare(b.rollNumber);
      if (rollCompare !== 0) return rollCompare;

      return a.studentId - b.studentId;
    });

    let remainingAmount = Number(receivePaymentAmount) || 0;

    return rows.map((fee) => {
      const allocation = Math.max(
        0,
        Math.min(fee.remaining, remainingAmount),
      );

      remainingAmount -= allocation;

      return {
        ...fee,
        allocation,
      };
    });
  }, [receivePaymentFamily, receivePaymentAmount]);

  const [payments, setPayments] = useState<FeePayment[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [lastPayment, setLastPayment] = useState<FeePayment | null>(null);

  const [structureForm, setStructureForm] = useState({
    classId: '',
    feeName: 'Monthly Tuition Fee',
    amount: '',
  });

  const [studentFeeForm, setStudentFeeForm] = useState({
    studentId: '',
    feeStructureId: '',
    feePeriod: currentMonth(),
    notes: '',
  });

  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    paymentDate: today(),
    paymentMethod: 'cash' as FeePayment['paymentMethod'],
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
      feeRulesRes,
      familiesRes,
      feePeriodsRes,
    ] = await Promise.all([
      feesApi.listStructures(),
      feesApi.listStudentFees({ period: selectedPeriod }),
      feesApi.getSummary(selectedPeriod),
      studentsApi.list(),
      classesApi.list(),
      feeRulesApi.list(),
      api.get<FamilySummary[]>('/families'),
      feesApi.listStudentFeePeriods(),
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
    setFeeRules(feeRulesRes);
    setFamilies(familiesRes.data ?? []);
    if (feePeriodsRes.success) {
      setHistoryPeriods(
        (feePeriodsRes.data ?? []).filter((period) => period < selectedPeriod)
      );
    }
        const settingsRes = await api.get<SchoolSettings>('/settings');

    if (settingsRes.success && settingsRes.data) {
      setSchoolSettings(settingsRes.data);
    }
    setLoading(false);
  }

  useEffect(() => {
    void loadData();
  }, [selectedPeriod]);

  async function loadHistory(period: string) {
    if (!period || period >= selectedPeriod) {
      setHistoryFees([]);
      return;
    }

    setHistoryLoading(true);

    try {
      const response = await feesApi.listStudentFees({ period });

      if (!response.success) {
        setError(response.error ?? 'Failed to load fee history.');
        setHistoryFees([]);
        return;
      }

      setHistoryFees(response.data ?? []);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Failed to load fee history.'
      );
      setHistoryFees([]);
    } finally {
      setHistoryLoading(false);
    }
  }


  const filteredStudentFees = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return studentFees.filter((fee) => {
      if (
        statusFilter !== 'all' &&
        fee.effectiveStatus !== statusFilter
      ) {
        return false;
      }

      if (!query) {
        return true;
      }

      const student = students.find(
        (st) => st.id === fee.studentId
      );

      if (!student) {
        return false;
      }

      const family = families.find((item) =>
        item.children.some(
          (child) => child.id === student.id
        )
      );

      return [
        student.fullName,
        student.rollNumber,
        student.guardianName,
        student.guardianPhone ?? '',
        family?.guardianName ?? '',
        family?.guardianPhone ?? '',
        family?.address ?? '',
        ...(family?.children.flatMap((child) => [
          child.fullName,
          child.rollNumber,
          child.guardianName,
          child.guardianPhone ?? '',
          child.className,
        ]) ?? []),
      ].some((value) =>
        value.toLowerCase().includes(query)
      );
    });
  }, [studentFees, students, families, searchQuery, statusFilter]);

  const selectedFee = useMemo(
    () => studentFees.find((fee) => fee.id === selectedFeeId) ?? null,
    [studentFees, selectedFeeId]
  );

  const selectedFeeStructure = useMemo(() => {
    const structureId = Number(studentFeeForm.feeStructureId);

    if (!Number.isInteger(structureId) || structureId < 1) {
      return null;
    }

    return (
      structures.find((structure) => structure.id === structureId) ??
      null
    );
  }, [structures, studentFeeForm.feeStructureId]);

  const selectedFeeRule = useMemo(() => {
    const structureId = Number(studentFeeForm.feeStructureId);

    if (!Number.isInteger(structureId) || structureId < 1) {
      return null;
    }

    return (
      feeRules.find(
        (rule) =>
          rule.feeStructureId === structureId &&
          rule.isActive
      ) ?? null
    );
  }, [feeRules, studentFeeForm.feeStructureId]);

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

  async function loadReceivePaymentStudent(studentId: number) {
    setReceivePaymentWorkspaceOpen(true);
    setReceivePaymentMode('student');
    setReceivePaymentFamilyId(null);
    setReceivePaymentFamily(null);
    setReceivePaymentFamilyResult(null);
    setReceivePaymentLoading(true);
    setReceivePaymentStudent(null);
    setReceivePaymentStudentId(studentId);
    setError('');
    setNotice('');

    const res = await feesApi.getStudentOutstanding(studentId);

    if (!res.success) {
      setError(res.error ?? 'Failed to load outstanding student fees.');
      setReceivePaymentLoading(false);
      return;
    }

    setReceivePaymentStudent(res.data ?? null);

    if (res.data) {
      setReceivePaymentAmount(
        res.data.totalOutstanding > 0
          ? String(res.data.totalOutstanding)
          : '',
      );
    } else {
      setReceivePaymentAmount('');
    }

    setReceivePaymentDate(today());
    setReceivePaymentMethod('cash');
    setReceivePaymentNotes('');
    setReceivePaymentConfirmed(false);
    setReceivePaymentLoading(false);
  }

  async function loadReceivePaymentFamily(familyId: number) {
    setReceivePaymentWorkspaceOpen(true);
    setReceivePaymentMode('family');
    setReceivePaymentStudentId(null);
    setReceivePaymentStudent(null);
    setReceivePaymentFamilyLoading(true);
    setReceivePaymentFamily(null);
    setReceivePaymentFamilyId(familyId);
    setError('');
    setNotice('');

    const res = await familyPaymentsApi.outstanding(familyId);

    if (!res.success) {
      setError(res.error ?? 'Failed to load outstanding family fees.');
      setReceivePaymentFamilyLoading(false);
      return;
    }

    setReceivePaymentFamily(res.data ?? null);

    if (res.data) {
      setReceivePaymentAmount(
        res.data.totalOutstanding > 0
          ? String(res.data.totalOutstanding)
          : '',
      );
    } else {
      setReceivePaymentAmount('');
    }

    setReceivePaymentDate(today());
    setReceivePaymentMethod('cash');
    setReceivePaymentNotes('');
    setReceivePaymentConfirmed(false);
    setReceivePaymentFamilyResult(null);
    setReceivePaymentFamilyLoading(false);
  }

  const receivePaymentFamilySummary = useMemo(() => {
    if (!receivePaymentFamily) return null;

    const family = families.find(
      (item) => item.id === receivePaymentFamily.familyId,
    );

    return {
      guardianName: family?.guardianName ?? 'Family',
      guardianPhone: family?.guardianPhone ?? null,
      childrenCount: receivePaymentFamily.children.length,
    };
  }, [families, receivePaymentFamily]);

  function closeReceivePayment() {
    setReceivePaymentWorkspaceOpen(false);
    setReceivePaymentStudentId(null);
    setReceivePaymentStudent(null);
    setReceivePaymentAmount('');
    setReceivePaymentDate(today());
    setReceivePaymentMethod('cash');
    setReceivePaymentNotes('');
    setReceivePaymentConfirmed(false);
  }

  function selectFee(fee: StudentFee) {
    setStudentFeeSearch('');
    setSelectedFeeId(fee.id);
    setError('');
    setNotice('');

    void loadPayments(fee.id);

    setPaymentForm({
      amount:
        fee.amountRemaining > 0 ? String(fee.amountRemaining) : '',
      paymentDate: today(),
      paymentMethod: 'cash',
        notes: '',
    });
  }

  async function waiveFine() {
  setError('');
  setNotice('');

  if (!selectedFeeId) {
    setError('Select a student fee first.');
    return;
  }

  const waivedAmount = Number(fineWaiveForm.amount);
  const reason = fineWaiveForm.reason.trim();

  if (!Number.isInteger(waivedAmount) || waivedAmount <= 0) {
    setError('Waived amount must be greater than zero.');
    return;
  }

  if (!reason) {
    setError('A reason is required for a fine waiver.');
    return;
  }

  if (reason.length > 500) {
    setError('Fine waiver reason cannot exceed 500 characters.');
    return;
  }

  const configuredFine = Number(selectedFee?.fineAmount ?? 0);
  const alreadyWaived = Number(
    selectedFee?.fineWaivedAmount ?? 0
  );
  const remainingWaiverable = Math.max(
    0,
    configuredFine - alreadyWaived
  );

  if (waivedAmount > remainingWaiverable) {
    setError(
      `Waived amount cannot exceed remaining waiverable fine of ${formatAmount(
        remainingWaiverable
      )}.`
    );
    return;
  }

  setSaving(true);

  try {
    const res = await api.post<{
      id: number;
      studentId: number;
      feePeriod: string;
      amountDue: number;
      fineAmount: number;
      fineWaived: boolean;
      fineWaivedAmount: number;
      fineWaivedAt: string | null;
      fineWaivedBy: number | null;
      fineWaivedReason: string | null;
      paidAmount: number;
      remainingAmount: number;
    }>(
      `/fees/student-fees/${selectedFeeId}/fine-waive`,
      {
        waivedAmount,
        reason,
      }
    );

    if (!res.success || !res.data) {
      setError(res.error ?? 'Failed to waive fine.');
      return;
    }

    setNotice(
      `Fine waiver recorded successfully: ${formatAmount(
        res.data.fineWaivedAmount
      )}.`
    );

    setFineWaiveForm({
      amount: '',
      reason: '',
    });

    await loadData();
    await loadPayments(selectedFeeId);
  } catch (err) {
    setError(
      err instanceof Error
        ? err.message
        : 'Failed to waive fine.'
    );
  } finally {
    setSaving(false);
  }
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

  function handleFeeStructureChange(value: string) {
    setStudentFeeForm((current) => ({
      ...current,
      feeStructureId: value,
    }));
  }

  async function createReceivePayment() {
    setError('');
    setNotice('');
    setReceivePaymentConfirmed(false);

    if (!receivePaymentStudent) {
      setError('Select a student with outstanding fees first.');
      return;
    }

    const amount = Number(receivePaymentAmount);

    if (!Number.isInteger(amount) || amount < 1) {
      setError('Payment amount must be a positive whole number.');
      return;
    }

    if (amount > receivePaymentStudent.totalOutstanding) {
      setError(
        `Payment cannot exceed total outstanding of ${formatAmount(
          receivePaymentStudent.totalOutstanding,
        )}.`,
      );
      return;
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(receivePaymentDate)) {
      setError('Payment date must use YYYY-MM-DD format.');
      return;
    }

    if (
      receivePaymentAllocationPreview.every(
        (fee) => fee.allocation <= 0,
      )
    ) {
      setError('Enter a payment amount to see the allocation.');
      return;
    }

    setSaving(true);

    const res = await feesApi.createStudentPayment({
      studentId: receivePaymentStudent.studentId,
      amount,
      paymentDate: receivePaymentDate,
      paymentMethod: receivePaymentMethod,
      notes: receivePaymentNotes.trim() || undefined,
    });

    if (!res.success) {
      setError(res.error ?? 'Failed to record payment.');
      setSaving(false);
      return;
    }

    if (!res.data) {
      setError(
        'Payment was recorded, but payment details were not returned.',
      );
      setSaving(false);
      return;
    }

    setReceivePaymentResult(res.data);
    setReceivePaymentConfirmed(true);
    setNotice(
      `Payment recorded successfully. Receipt ${res.data.receiptNumber}.`,
    );
    setSaving(false);

    setReceivePaymentAmount('');
    setReceivePaymentNotes('');

    await loadData();

    const refreshed = await feesApi.getStudentOutstanding(
      receivePaymentStudent.studentId,
    );

    if (refreshed.success && refreshed.data) {
      setReceivePaymentStudent(refreshed.data);
    } else if (!refreshed.success) {
      setError(
        refreshed.error ??
          'Payment recorded, but outstanding balance could not be refreshed.',
      );
    }
  }

  async function createReceiveFamilyPayment() {
    setError('');
    setNotice('');
    setReceivePaymentConfirmed(false);

    if (!receivePaymentFamily) {
      setError('Select a family with outstanding fees first.');
      return;
    }

    const amount = Number(receivePaymentAmount);

    if (!Number.isInteger(amount) || amount < 1) {
      setError('Payment amount must be a positive whole number.');
      return;
    }

    if (amount > receivePaymentFamily.totalOutstanding) {
      setError(
        `Payment cannot exceed total family outstanding of ${formatAmount(
          receivePaymentFamily.totalOutstanding,
        )}.`,
      );
      return;
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(receivePaymentDate)) {
      setError('Payment date must use YYYY-MM-DD format.');
      return;
    }

    const items = receivePaymentFamilyAllocationPreview
      .filter((fee) => fee.allocation > 0)
      .map((fee) => ({
        studentFeeId: fee.studentFeeId,
        amount: Math.trunc(fee.allocation),
      }));

    if (items.length === 0) {
      setError('Enter a payment amount to see the family allocation.');
      return;
    }

    const allocatedTotal = items.reduce(
      (total, item) => total + item.amount,
      0,
    );

    if (allocatedTotal !== amount) {
      setError('Family payment allocation does not match the payment amount.');
      return;
    }

    setSaving(true);

    try {
      const res = await familyPaymentsApi.create({
        familyId: receivePaymentFamily.familyId,
        paymentDate: receivePaymentDate,
        paymentMethod: receivePaymentMethod,
        items,
        notes: receivePaymentNotes.trim() || null,
      });

      if (!res.success || !res.data) {
        setError(res.error ?? 'Failed to record family payment.');
        return;
      }

      setReceivePaymentFamilyResult(res.data);
      setReceivePaymentConfirmed(true);
      setNotice(
        `Family payment recorded successfully. Receipt ${res.data.receiptNumber}.`,
      );

      setReceivePaymentAmount('');
      setReceivePaymentNotes('');

      await loadData();

      const refreshed = await familyPaymentsApi.outstanding(
        receivePaymentFamily.familyId,
      );

      if (refreshed.success && refreshed.data) {
        setReceivePaymentFamily(refreshed.data);
      } else if (!refreshed.success) {
        setError(
          refreshed.error ??
            'Payment recorded, but family outstanding balance could not be refreshed.',
        );
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to record family payment.',
      );
    } finally {
      setSaving(false);
    }
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

    if (amount > selectedFee.totalRemaining) {
      setError(
        `Payment cannot exceed total remaining balance of ${formatAmount(
          selectedFee.totalRemaining
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
      notes: paymentForm.notes.trim() || undefined,
    });

    if (!res.success) {
      setError(res.error ?? 'Failed to record payment.');
      setSaving(false);
      return;
    }

    if (!res.data) {
      setError('Payment was recorded, but receipt data was not returned.');
      setSaving(false);
      return;
    }

    setNotice('Payment recorded successfully.');
    setLastPayment(res.data);
    setSaving(false);

    setPaymentForm({
      amount: '',
      paymentDate: today(),
      paymentMethod: 'cash',
      notes: '',
    });

    await loadData();
    await loadPayments(selectedFee.id);
  }

    function printProfessionalReceipt() {
    if (!receivePaymentResult || !receivePaymentStudent) {
      setError('Complete a payment first before printing the receipt.');
      return;
    }

    const schoolName =
      schoolSettings?.schoolName?.trim() || 'School Office';

    const schoolAddress =
      schoolSettings?.schoolAddress?.trim() || '';

    const phone =
      schoolSettings?.phone?.trim() || '';

    const email =
      schoolSettings?.email?.trim() || '';

    const receiptWindow = window.open(
      '',
      '_blank',
      'width=800,height=900'
    );

    if (!receiptWindow) {
      setError(
        'Unable to open receipt window. Please allow pop-ups for this site.'
      );
      return;
    }

    const escapeHtml = (value: string): string =>
      value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');

    const allocationRows = receivePaymentResult.allocations
      .map((allocation) => {
        const fee = receivePaymentStudent.fees.find(
          (item) => item.studentFeeId === allocation.studentFeeId
        );

        return `
          <tr>
            <td>${escapeHtml(allocation.feePeriod)}</td>
            <td>${formatAmount(allocation.amount)}</td>
            <td>${
              fee
                ? formatAmount(fee.remaining)
                : '?'
            }</td>
          </tr>
        `;
      })
      .join('');

    receiptWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8" />
          <title>Fee Receipt - ${escapeHtml(
            receivePaymentResult.receiptNumber
          )}</title>

          <style>
            * {
              box-sizing: border-box;
            }

            body {
              margin: 0;
              padding: 30px;
              font-family: Arial, sans-serif;
              color: #111827;
              background: #ffffff;
            }

            .receipt {
              max-width: 720px;
              margin: 0 auto;
              border: 1px solid #d1d5db;
              padding: 32px;
            }

            .header {
              text-align: center;
              border-bottom: 2px solid #111827;
              padding-bottom: 18px;
              margin-bottom: 22px;
            }

            .school-name {
              font-size: 25px;
              font-weight: 700;
              margin-bottom: 8px;
            }

            .school-info {
              font-size: 13px;
              color: #4b5563;
              line-height: 1.6;
            }

            .title {
              text-align: center;
              font-size: 20px;
              font-weight: 700;
              margin-bottom: 22px;
              text-transform: uppercase;
            }

            .grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 12px 24px;
              margin-bottom: 22px;
            }

            .item {
              padding: 9px 0;
              border-bottom: 1px solid #e5e7eb;
            }

            .label {
              font-size: 12px;
              color: #6b7280;
              margin-bottom: 4px;
            }

            .value {
              font-weight: 600;
            }

            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 18px;
            }

            th,
            td {
              border: 1px solid #d1d5db;
              padding: 10px;
              text-align: left;
            }

            th {
              background: #f3f4f6;
              font-weight: 700;
            }

            .total {
              margin-top: 18px;
              padding: 14px;
              border: 2px solid #111827;
              display: flex;
              justify-content: space-between;
              font-size: 18px;
              font-weight: 700;
            }

            .footer {
              margin-top: 30px;
              padding-top: 18px;
              border-top: 1px solid #d1d5db;
              font-size: 12px;
              color: #6b7280;
              text-align: center;
            }

            @media print {
              body {
                padding: 0;
              }

              .receipt {
                border: none;
                max-width: none;
              }
            }
          </style>
        </head>

        <body>
          <div class="receipt">
            <div class="header">
              <div class="school-name">
                ${escapeHtml(schoolName)}
              </div>

              <div class="school-info">
                ${schoolAddress
                  ? `${escapeHtml(schoolAddress)}<br />`
                  : ''}
                ${phone ? `Phone: ${escapeHtml(phone)}<br />` : ''}
                ${email ? `Email: ${escapeHtml(email)}` : ''}
              </div>
            </div>

            <div class="title">Fee Payment Receipt</div>

            <div class="grid">
              <div class="item">
                <div class="label">Receipt Number</div>
                <div class="value">
                  ${escapeHtml(
                    receivePaymentResult.receiptNumber
                  )}
                </div>
              </div>

              <div class="item">
                <div class="label">Payment Date</div>
                <div class="value">
                  ${escapeHtml(
                    receivePaymentResult.paymentDate
                  )}
                </div>
              </div>

              <div class="item">
                <div class="label">Student</div>
                <div class="value">
                  ${escapeHtml(
                    receivePaymentStudent.studentName
                  )}
                </div>
              </div>

              <div class="item">
                <div class="label">Roll Number</div>
                <div class="value">
                  ${escapeHtml(
                    receivePaymentStudent.rollNumber
                  )}
                </div>
              </div>

              <div class="item">
                <div class="label">Guardian</div>
                <div class="value">
                  ${escapeHtml(
                    receivePaymentStudent.guardianName
                  )}
                </div>
              </div>

              <div class="item">
                <div class="label">Payment Method</div>
                <div class="value">
                  ${escapeHtml(
                    receivePaymentResult.paymentMethod
                  )}
                </div>
              </div>
            </div>

            <table>
              <thead>
                <tr>
                  <th>Fee Period</th>
                  <th>Amount Paid</th>
                  <th>Outstanding Before Payment</th>
                </tr>
              </thead>

              <tbody>
                ${allocationRows}
              </tbody>
            </table>

            <div class="total">
              <span>Total Received</span>
              <span>
                ${formatAmount(
                  receivePaymentResult.totalAmount
                )}
              </span>
            </div>

            <div class="footer">
              This is a computer-generated fee payment receipt.
            </div>
          </div>

          <script>
            window.onload = function () {
              window.print();
            };
          </script>
        </body>
      </html>
    `);

    receiptWindow.document.close();
  }

    function printProfessionalFamilyReceipt() {
    if (!receivePaymentFamilyResult || !receivePaymentFamily) {
      setError('Complete a family payment first before printing the receipt.');
      return;
    }

    const schoolName =
      schoolSettings?.schoolName?.trim() || 'School Office';

    const schoolAddress =
      schoolSettings?.schoolAddress?.trim() || '';

    const phone =
      schoolSettings?.phone?.trim() || '';

    const email =
      schoolSettings?.email?.trim() || '';

    const family = receivePaymentFamilySummary;

    const receiptWindow = window.open(
      '',
      '_blank',
      'width=800,height=900'
    );

    if (!receiptWindow) {
      setError(
        'Unable to open receipt window. Please allow pop-ups for this site.'
      );
      return;
    }

    const escapeHtml = (value: string): string =>
      value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');

    const allocationRows = receivePaymentFamilyResult.payments
      .map((payment) => {
        const child = receivePaymentFamily.children.find(
          (item) => item.studentId === payment.studentId
        );

        const fee = child?.fees.find(
          (item) => item.studentFeeId === payment.studentFeeId
        );

        return `
          <tr>
            <td>${escapeHtml(payment.studentName)}</td>
            <td>${escapeHtml(child?.rollNumber ?? '')}</td>
            <td>${escapeHtml(child?.className ?? '')}</td>
            <td>${escapeHtml(fee?.feePeriod ?? '')}</td>
            <td>${formatAmount(payment.amount)}</td>
          </tr>
        `;
      })
      .join('');

    receiptWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8" />
          <title>Family Fee Receipt - ${escapeHtml(
            receivePaymentFamilyResult.receiptNumber
          )}</title>

          <style>
            * {
              box-sizing: border-box;
            }

            body {
              margin: 0;
              padding: 30px;
              font-family: Arial, sans-serif;
              color: #111827;
              background: #ffffff;
            }

            .receipt {
              max-width: 760px;
              margin: 0 auto;
              border: 1px solid #d1d5db;
              padding: 32px;
            }

            .header {
              text-align: center;
              border-bottom: 2px solid #111827;
              padding-bottom: 18px;
              margin-bottom: 22px;
            }

            .school-name {
              font-size: 25px;
              font-weight: 700;
              margin-bottom: 8px;
            }

            .school-info {
              font-size: 13px;
              color: #4b5563;
              line-height: 1.6;
            }

            .title {
              text-align: center;
              font-size: 20px;
              font-weight: 700;
              margin-bottom: 22px;
              text-transform: uppercase;
            }

            .badge {
              display: inline-block;
              margin-top: 8px;
              padding: 5px 10px;
              border-radius: 999px;
              background: #f3f4f6;
              font-size: 12px;
              font-weight: 700;
            }

            .grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 12px 24px;
              margin-bottom: 22px;
            }

            .item {
              padding: 9px 0;
              border-bottom: 1px solid #e5e7eb;
            }

            .label {
              font-size: 12px;
              color: #6b7280;
              margin-bottom: 4px;
            }

            .value {
              font-weight: 600;
            }

            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 18px;
            }

            th,
            td {
              border: 1px solid #d1d5db;
              padding: 9px;
              text-align: left;
              font-size: 13px;
            }

            th {
              background: #f3f4f6;
              font-weight: 700;
            }

            .total {
              margin-top: 18px;
              padding: 14px;
              border: 2px solid #111827;
              display: flex;
              justify-content: space-between;
              font-size: 18px;
              font-weight: 700;
            }

            .footer {
              margin-top: 30px;
              padding-top: 18px;
              border-top: 1px solid #d1d5db;
              font-size: 12px;
              color: #6b7280;
              text-align: center;
              line-height: 1.6;
            }

            @media print {
              body {
                padding: 0;
              }

              .receipt {
                border: none;
                max-width: none;
              }
            }
          </style>
        </head>

        <body>
          <div class="receipt">
            <div class="header">
              <div class="school-name">
                ${escapeHtml(schoolName)}
              </div>

              <div class="school-info">
                ${schoolAddress
                  ? `${escapeHtml(schoolAddress)}<br />`
                  : ''}
                ${phone ? `Phone: ${escapeHtml(phone)}<br />` : ''}
                ${email ? `Email: ${escapeHtml(email)}` : ''}
              </div>

              <div class="badge">FAMILY PAYMENT</div>
            </div>

            <div class="title">Family Fee Payment Receipt</div>

            <div class="grid">
              <div class="item">
                <div class="label">Receipt Number</div>
                <div class="value">
                  ${escapeHtml(
                    receivePaymentFamilyResult.receiptNumber
                  )}
                </div>
              </div>

              <div class="item">
                <div class="label">Payment Date</div>
                <div class="value">
                  ${escapeHtml(
                    receivePaymentFamilyResult.paymentDate
                  )}
                </div>
              </div>

              <div class="item">
                <div class="label">Guardian / Family</div>
                <div class="value">
                  ${escapeHtml(family?.guardianName ?? 'Family')}
                </div>
              </div>

              <div class="item">
                <div class="label">Guardian Phone</div>
                <div class="value">
                  ${escapeHtml(family?.guardianPhone ?? '?')}
                </div>
              </div>

              <div class="item">
                <div class="label">Children</div>
                <div class="value">
                  ${String(family?.childrenCount ?? 0)}
                </div>
              </div>

              <div class="item">
                <div class="label">Payment Method</div>
                <div class="value">
                  ${escapeHtml(
                    receivePaymentFamilyResult.paymentMethod
                  )}
                </div>
              </div>
            </div>

            <table>
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Roll No.</th>
                  <th>Class</th>
                  <th>Fee Period</th>
                  <th>Amount Paid</th>
                </tr>
              </thead>

              <tbody>
                ${allocationRows}
              </tbody>
            </table>

            <div class="total">
              <span>Total Received</span>
              <span>
                ${formatAmount(
                  receivePaymentFamilyResult.totalAmount
                )}
              </span>
            </div>

            <div class="footer">
              This receipt records the family payment allocation shown above.<br />
              This is a computer-generated fee payment receipt.
            </div>
          </div>

          <script>
            window.onload = function () {
              window.print();
            };
          </script>
        </body>
      </html>
    `);

    receiptWindow.document.close();
  }

    function printReceipt(payment: FeePayment) {
    if (!selectedFee) {
      setError('Select a student fee first.');
      return;
    }

    const schoolName =
      schoolSettings?.schoolName?.trim() || 'School Office';

    const schoolAddress =
      schoolSettings?.schoolAddress?.trim() || '';

    const phone =
      schoolSettings?.phone?.trim() || '';

    const email =
      schoolSettings?.email?.trim() || '';

    const remainingBalance = selectedFee.amountRemaining;

    const receiptWindow = window.open(
      '',
      '_blank',
      'width=800,height=900'
    );

    if (!receiptWindow) {
      setError(
        'Unable to open receipt window. Please allow pop-ups for this site.'
      );
      return;
    }

    const escapeHtml = (value: string): string =>
      value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');

    receiptWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8" />
          <title>Fee Receipt - ${escapeHtml(
            payment.receiptNumber
          )}</title>

          <style>
            * {
              box-sizing: border-box;
            }

            body {
              margin: 0;
              padding: 30px;
              font-family: Arial, sans-serif;
              color: #111827;
              background: #ffffff;
            }

            .receipt {
              max-width: 700px;
              margin: 0 auto;
              border: 1px solid #d1d5db;
              padding: 32px;
            }

            .header {
              text-align: center;
              border-bottom: 2px solid #111827;
              padding-bottom: 18px;
              margin-bottom: 24px;
            }

            .school-name {
              font-size: 25px;
              font-weight: 700;
              margin-bottom: 8px;
            }

            .school-info {
              font-size: 13px;
              color: #4b5563;
              line-height: 1.6;
            }

            .title {
              text-align: center;
              font-size: 20px;
              font-weight: 700;
              margin-bottom: 24px;
              text-transform: uppercase;
            }

            .row {
              display: flex;
              justify-content: space-between;
              gap: 24px;
              padding: 10px 0;
              border-bottom: 1px solid #e5e7eb;
            }

            .label {
              font-weight: 600;
              color: #4b5563;
            }

            .value {
              text-align: right;
              font-weight: 500;
            }

            .amount {
              font-size: 22px;
              font-weight: 700;
            }

            .footer {
              margin-top: 30px;
              padding-top: 18px;
              border-top: 1px solid #d1d5db;
              font-size: 12px;
              color: #6b7280;
              text-align: center;
            }

            @media print {
              body {
                padding: 0;
              }

              .receipt {
                border: none;
                max-width: none;
              }
            }
          </style>
        </head>

        <body>
          <div class="receipt">

            <div class="header">
              <div class="school-name">
                ${escapeHtml(schoolName)}
              </div>

              <div class="school-info">
                ${schoolAddress
                  ? `${escapeHtml(schoolAddress)}<br />`
                  : ''}
                ${phone
                  ? `Phone: ${escapeHtml(phone)}<br />`
                  : ''}
                ${email
                  ? `Email: ${escapeHtml(email)}`
                  : ''}
              </div>
            </div>

            <div class="title">
              Fee Payment Receipt
            </div>

            <div class="row">
              <span class="label">Receipt Number</span>
              <span class="value">
                ${escapeHtml(payment.receiptNumber)}
              </span>
            </div>

            <div class="row">
              <span class="label">Student Name</span>
              <span class="value">
                ${escapeHtml(selectedFee.studentName)}
              </span>
            </div>

            <div class="row">
              <span class="label">Roll Number</span>
              <span class="value">
                ${escapeHtml(selectedFee.rollNumber)}
              </span>
            </div>

            <div class="row">
              <span class="label">Fee Period</span>
              <span class="value">
                ${escapeHtml(selectedFee.feePeriod)}
              </span>
            </div>

            ${
              selectedFee.dueDate
                ? `
            <div class="row">
              <span class="label">Due Date</span>
              <span class="value">
                ${escapeHtml(selectedFee.dueDate)}
              </span>
            </div>
            `
                : ''
            }

            ${
              selectedFee.daysOverdue > 0
                ? `
            <div class="row">
              <span class="label">Overdue</span>
              <span class="value">
                ${selectedFee.daysOverdue} day(s)
              </span>
            </div>
            `
                : ''
            }

            <div class="row">
              <span class="label">Payment Date</span>
              <span class="value">
                ${escapeHtml(payment.paymentDate)}
              </span>
            </div>

            <div class="row">
              <span class="label">Payment Method</span>
              <span class="value">
                ${escapeHtml(payment.paymentMethod)}
              </span>
            </div>

            <div class="row">
              <span class="label">Amount Paid</span>
              <span class="value amount">
                ${formatAmount(payment.amount)}
              </span>
            </div>

            <div class="row">
              <span class="label">Current Remaining Balance</span>
              <span class="value">
                ${formatAmount(remainingBalance)}
              </span>
            </div>

            <div class="row">
              <span class="label">Received By</span>
              <span class="value">
                ${escapeHtml(payment.receivedByName)}
              </span>
            </div>

            ${
              payment.notes
                ? `
                  <div class="row">
                    <span class="label">Notes</span>
                    <span class="value">
                      ${escapeHtml(payment.notes)}
                    </span>
                  </div>
                `
                : ''
            }

            <div class="footer">
              Thank you. This is a computer-generated fee receipt.
            </div>

          </div>
        </body>
      </html>
    `);

    receiptWindow.document.close();
    receiptWindow.focus();

    receiptWindow.onafterprint = () => {
      receiptWindow.close();
    };

    receiptWindow.print();
  }

  return (
    <div>
      {summary && (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns:
                'repeat(auto-fit, minmax(190px, 1fr))',
              gap: '0.9rem',
              marginBottom: '1.25rem',
            }}
          >
            {[
              {
                key: 'paid' as const,
                title: 'Paid',
                count: summary.paidCount,
                description: 'Fully paid this month',
              },
              {
                key: 'partial' as const,
                title: 'Balance Due',
                count: summary.partialCount,
                description: 'Partially paid',
              },
              {
                key: 'unpaid' as const,
                title: 'Unpaid',
                count: summary.unpaidCount,
                description: 'No payment received',
              },
            ].map((item) => {
              const active =
                viewMode === 'current' && statusFilter === item.key;

              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => {
                    setViewMode('current');
                    setStatusFilter(item.key);
                  }}
                  style={{
                    ...s.card,
                    textAlign: 'left',
                    cursor: 'pointer',
                    padding: '1rem 1.05rem',
                    borderRadius: 16,
                    border: active
                      ? `2px solid ${colors.primary}`
                      : `1px solid ${colors.border}`,
                    background: active
                      ? 'linear-gradient(135deg, #dbeafe 0%, #eff6ff 100%)'
                      : 'linear-gradient(135deg, #ffffff 0%, #f8fbff 100%)',
                    boxShadow: active
                      ? '0 10px 24px rgba(18,59,93,0.14)'
                      : '0 8px 20px rgba(18,59,93,0.065)',
                    transition:
                      'background 180ms ease, border-color 180ms ease, transform 180ms ease, box-shadow 180ms ease',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '0.75rem',
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontSize: '0.78rem',
                          fontWeight: 750,
                          color: colors.text,
                          textTransform: 'uppercase',
                          letterSpacing: '0.045em',
                        }}
                      >
                        {item.title}
                      </div>

                      <div
                        style={{
                          marginTop: '0.3rem',
                          fontSize: '1.55rem',
                          fontWeight: 750,
                          lineHeight: 1.1,
                          color: colors.primary,
                        }}
                      >
                        {item.count}
                      </div>
                    </div>

                    <span
                      style={{
                        fontSize: '1.15rem',
                        color: colors.muted,
                      }}
                    >
                      {active ? '?' : '?'}
                    </span>
                  </div>

                  <div
                    style={{
                      marginTop: '0.35rem',
                      fontSize: '0.78rem',
                      color: colors.muted,
                    }}
                  >
                    {item.description}
                  </div>
                </button>
              );
            })}
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              marginBottom: '1.25rem',
            }}
          >
            <button
              type="button"
              onClick={() => {
                setViewMode(
                  viewMode === 'history' ? 'current' : 'history'
                );
                setStatusFilter('all');
              }}
              style={{
                ...s.buttonSecondary,
                padding: '0.68rem 1.05rem',
                minWidth: 178,
                borderRadius: 11,
                border: '1px solid rgba(22,119,200,0.20)',
                background:
                  'linear-gradient(135deg, #ffffff 0%, #eef6ff 100%)',
                color: '#123B5D',
                fontWeight: 750,
                boxShadow: '0 7px 16px rgba(18,59,93,0.09)',
                transition:
                  'transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease',
              }}
              onMouseEnter={event => {
                event.currentTarget.style.transform = 'translateY(-1px)';
                event.currentTarget.style.boxShadow =
                  '0 10px 22px rgba(18,59,93,0.13)';
                event.currentTarget.style.borderColor =
                  'rgba(22,119,200,0.34)';
              }}
              onMouseLeave={event => {
                event.currentTarget.style.transform = '';
                event.currentTarget.style.boxShadow =
                  '0 7px 16px rgba(18,59,93,0.09)';
                event.currentTarget.style.borderColor =
                  'rgba(22,119,200,0.20)';
              }}
              onFocus={event => {
                event.currentTarget.style.boxShadow =
                  '0 0 0 3px rgba(22,119,200,0.13), 0 9px 20px rgba(18,59,93,0.10)';
              }}
              onBlur={event => {
                event.currentTarget.style.boxShadow =
                  '0 7px 16px rgba(18,59,93,0.09)';
              }}
            >
              {viewMode === 'history'
                ? 'Back to Current Month'
                : 'View Previous Months'}
            </button>
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              marginBottom: '1rem',
            }}
          >
            <button
              type="button"
              style={{
                ...s.btnPrimary,
                minWidth: 190,
                padding: '0.72rem 1.15rem',
                borderRadius: 11,
                background:
                  'linear-gradient(135deg, #123B5D 0%, #1677C8 62%, #38BDF8 100%)',
                border: '1px solid rgba(18,59,93,0.18)',
                color: '#fff',
                fontWeight: 750,
                letterSpacing: 0.1,
                boxShadow:
                  '0 10px 22px rgba(18,59,93,0.20), 0 0 0 1px rgba(56,189,248,0.06)',
                transition:
                  'transform 160ms ease, box-shadow 160ms ease, filter 160ms ease',
              }}
              onMouseEnter={event => {
                event.currentTarget.style.transform = 'translateY(-2px)';
                event.currentTarget.style.boxShadow =
                  '0 13px 28px rgba(18,59,93,0.25), 0 0 0 1px rgba(56,189,248,0.10)';
                event.currentTarget.style.filter = 'brightness(1.03)';
              }}
              onMouseLeave={event => {
                event.currentTarget.style.transform = '';
                event.currentTarget.style.boxShadow =
                  '0 10px 22px rgba(18,59,93,0.20), 0 0 0 1px rgba(56,189,248,0.06)';
                event.currentTarget.style.filter = '';
              }}
              onMouseDown={event => {
                event.currentTarget.style.transform = 'translateY(0)';
              }}
              onMouseUp={event => {
                event.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onClick={() => {
                setReceivePaymentWorkspaceOpen(true);
                setReceivePaymentMode('student');
                setReceivePaymentStudentId(null);
                setReceivePaymentStudent(null);
                setReceivePaymentFamilyId(null);
                setReceivePaymentFamily(null);
                setReceivePaymentFamilyResult(null);
                setReceivePaymentAmount('');
                setReceivePaymentDate(today());
                setReceivePaymentMethod('cash');
                setReceivePaymentNotes('');
                setReceivePaymentConfirmed(false);
                setError('');
                setNotice('');
              }}
            >
              Receive Payment
            </button>
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '1rem',
              flexWrap: 'wrap',
              marginBottom: '1.25rem',
              padding: '0 0.15rem',
            }}
          >
            <div style={s.muted}>
              Current month: <strong>{selectedPeriod}</strong>
            </div>

            <div style={s.muted}>
              Outstanding:{' '}
              <strong>{formatAmount(summary.totalRemaining)}</strong>
            </div>
          </div>
        </>
      )}

      <div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
            flexWrap: 'wrap',
            marginBottom: '1.25rem',
          }}
        >
          <div>
            <h1 style={s.pageTitle}>Fees</h1>
            <p style={s.muted}>
              Manage monthly fees, family balances, and payments.
            </p>
          </div>

        </div>

        {error && <p style={s.errText}>{error}</p>}
        {notice && <p style={s.okText}>{notice}</p>}

        <style>{`
          .soa-fees-search:focus {
            outline: none;
            border-color: #1677C8 !important;
            box-shadow: 0 0 0 3px rgba(22,119,200,0.12) !important;
          }
        `}</style>

        <div
          style={{
            ...s.card,
            display: 'grid',
            gridTemplateColumns:
              'minmax(180px, 0.35fr) minmax(280px, 1fr)',
            gap: '1rem',
            marginBottom: '1.5rem',
            alignItems: 'end',
            borderRadius: 16,
            border: `1px solid ${colors.border}`,
            background:
              'linear-gradient(135deg, #ffffff 0%, #f8fbff 100%)',
            boxShadow: '0 10px 28px rgba(18,59,93,0.07)',
          }}
        >
          <div>
            <label style={s.label}>Current Fee Month</label>
            <div
              style={{
                ...s.input,
                display: 'flex',
                alignItems: 'center',
                fontWeight: 750,
                color: '#123B5D',
                background:
                  'linear-gradient(135deg, #eef6ff 0%, #f8fbff 100%)',
                borderRadius: 10,
                border: '1px solid rgba(22,119,200,0.16)',
                boxShadow: 'inset 0 1px 2px rgba(18,59,93,0.03)',
              }}
            >
              {selectedPeriod}
            </div>
          </div>

          <div>
            <label style={s.label}>
              Search Student / Roll / Guardian / Family
            </label>
            <input
              value={searchQuery}
              onChange={(event) =>
                setSearchQuery(event.target.value)
              }
              placeholder="Search by student name, roll number, guardian or family..."
              className="soa-fees-search"
              style={{
                ...s.input,
                borderRadius: 10,
                transition:
                  'border-color 160ms ease, box-shadow 160ms ease',
              }}
            />
          </div>
        </div>

        {loading ? (
          <p style={s.spinner}>Loading fees...</p>
        ) : (
          <>
            <section
              style={{
                ...s.card,
                marginBottom: '1.5rem',
                borderRadius: 16,
                border: `1px solid ${colors.border}`,
                background:
                  'linear-gradient(135deg, #ffffff 0%, #f8fbff 100%)',
                boxShadow: '0 10px 28px rgba(18,59,93,0.07)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: '1rem',
                  flexWrap: 'wrap',
                  marginBottom: '1rem',
                }}
              >
                <div>
                  <h2 style={{ ...s.formTitle, marginBottom: 4 }}>
                    Fee Structure Setup
                  </h2>
                  <p style={{ ...s.muted, margin: 0 }}>
                    Configure the monthly fee amount for each class before
                    creating fee rules or assigning student fee plans.
                  </p>
                </div>

                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: '0.42rem 0.72rem',
                    borderRadius: 999,
                    background: '#eef6ff',
                    border: '1px solid rgba(22,119,200,0.14)',
                    color: '#123B5D',
                    fontSize: '0.82rem',
                    fontWeight: 750,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {structures.length} structure
                  {structures.length === 1 ? '' : 's'} configured
                </span>
              </div>

              <form
                onSubmit={createStructure}
                style={{
                  display: 'grid',
                  gridTemplateColumns:
                    'minmax(180px, 1fr) minmax(220px, 1.25fr) minmax(180px, 1fr) auto',
                  gap: '0.9rem',
                  alignItems: 'end',
                }}
              >
                <div>
                  <label style={s.label}>Class</label>
                  <select
                    value={structureForm.classId}
                    onChange={(event) =>
                      setStructureForm((current) => ({
                        ...current,
                        classId: event.target.value,
                      }))
                    }
                    style={s.input}
                    disabled={saving}
                  >
                    <option value="">Select class</option>
                    {classes
                      .filter((classItem) => classItem.isActive)
                      .map((classItem) => (
                        <option key={classItem.id} value={classItem.id}>
                          {classItem.name}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label style={s.label}>Fee Name</label>
                  <input
                    type="text"
                    value={structureForm.feeName}
                    onChange={(event) =>
                      setStructureForm((current) => ({
                        ...current,
                        feeName: event.target.value,
                      }))
                    }
                    placeholder="Monthly Tuition Fee"
                    style={s.input}
                    disabled={saving}
                  />
                </div>

                <div>
                  <label style={s.label}>Monthly Amount (Rs.)</label>
                  <input
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
                    placeholder="e.g. 5000"
                    style={s.input}
                    disabled={saving}
                  />
                </div>

                <button
                  type="submit"
                  disabled={saving || classes.filter((classItem) => classItem.isActive).length === 0}
                  style={{
                    ...s.btnPrimary,
                    minHeight: 42,
                    padding: '0.68rem 1rem',
                    borderRadius: 10,
                    whiteSpace: 'nowrap',
                    background:
                      'linear-gradient(135deg, #123B5D 0%, #1677C8 62%, #38BDF8 100%)',
                    border: '1px solid rgba(18,59,93,0.18)',
                    boxShadow: '0 8px 18px rgba(18,59,93,0.16)',
                    fontWeight: 750,
                  }}
                >
                  {saving ? 'Creating...' : 'Create Fee Structure'}
                </button>
              </form>

              {classes.filter((classItem) => classItem.isActive).length === 0 && (
                <p
                  style={{
                    ...s.muted,
                    margin: '0.85rem 0 0',
                    color: '#b45309',
                  }}
                >
                  Create an active class first, then configure its fee structure.
                </p>
              )}
            </section>


            {viewMode === 'current' && (
                <section style={s.card}>
                  <div style={s.between}>
                    <div>
                      <h2
                        style={{
                          ...s.formTitle,
                          marginBottom: 2,
                        }}
                      >
                        {statusFilter === 'all'
                          ? 'Current Month Fees'
                          : statusFilter === 'paid'
                            ? 'Paid Fees'
                            : statusFilter === 'partial'
                              ? 'Balance Due'
                              : 'Unpaid Fees'}
                      </h2>

                  <span style={s.muted}>
                    Select a fee to view its payment
                    history.
                  </span>
                </div>

                <span style={s.muted}>
                  {filteredStudentFees.length} record
                  {filteredStudentFees.length === 1
                    ? ''
                    : 's'}
                </span>
              </div>

              <div style={s.tableWrap}>
                {filteredStudentFees.length === 0 ? (
                  <div style={s.empty}>
                    {searchQuery.trim()
                      ? 'No matching student or family fee records found.'
                      : `No fee records for ${selectedPeriod}.`}
                  </div>
                ) : (
                  <table style={s.table}>
                    <thead>
                      <tr>
                        <th style={s.th}>Student</th>
                        <th style={s.th}>Roll No.</th>
                        <th style={s.th}>Period</th>
                        <th style={s.th}>Due Date</th>
                        <th style={s.th}>Amount Due</th>
                        <th style={s.th}>Fine</th>
                        <th style={s.th}>Total Payable</th>
                        <th style={s.th}>Paid</th>
                        <th style={s.th}>Remaining</th>
                        <th style={s.th}>Status</th>
                        <th style={s.th}>Action</th>
                      </tr>
                    </thead>

                    <tbody>
                      {filteredStudentFees.map((fee) => (
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
                            {fee.dueDate || '?'}
                          </td>

                          <td style={s.td}>
                            {formatAmount(fee.amountDue)}
                          </td>

                          <td style={s.td}>
                            {formatAmount(fee.appliedFine)}
                            {fee.fineApplicable && (
                              <div style={s.muted}>
                                Applied
                              </div>
                            )}
                          </td>

                          <td style={s.td}>
                            {formatAmount(fee.totalPayable)}
                          </td>

                          <td style={s.td}>
                            {formatAmount(fee.amountPaid)}
                          </td>

                          <td style={s.td}>
                            {formatAmount(
                              fee.totalRemaining
                            )}
                          </td>

                          <td style={s.td}>
                            <span
                              style={statusStyle(
                                fee.effectiveStatus
                              )}
                            >
                              {statusLabel(fee.effectiveStatus)}
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
                                void loadReceivePaymentStudent(fee.studentId)
                              }
                            >
                              Receive Payment
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </section>
              )}

            {viewMode === 'history' && (
              <section style={s.card}>
                <div
                  style={{
                    ...s.between,
                    paddingBottom: '0.9rem',
                    borderBottom: `1px solid ${colors.border}`,
                  }}
                >
                  <div>
                    <h2
                      style={{
                        ...s.formTitle,
                        marginBottom: 2,
                      }}
                    >
                      Fee History
                    </h2>
                    <span style={s.muted}>
                      View previous months. Current month stays in the main dashboard.
                    </span>
                  </div>

                  <span style={s.muted}>
                    {historyFees.length} record
                    {historyFees.length === 1 ? '' : 's'}
                  </span>
                </div>

                <div
                  style={{
                    marginTop: '1rem',
                    marginBottom: '1rem',
                    padding: '1rem',
                    border: `1px solid ${colors.border}`,
                    borderRadius: 12,
                    background: colors.surfaceSoft,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '0.75rem',
                      flexWrap: 'wrap',
                    }}
                  >
                    <div>
                      <div style={s.label}>Previous Fee Months</div>
                      <div
                        style={{
                          marginTop: 3,
                          fontSize: '0.8rem',
                          color: colors.muted,
                        }}
                      >
                        Choose a completed month to review its fee records.
                      </div>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.45rem',
                      }}
                    >
                      <button
                        type="button"
                        aria-label="Previous year"
                        onClick={() =>
                          setHistoryPickerYear((year) => year - 1)
                        }
                        style={{
                          ...s.buttonSecondary,
                          width: 38,
                          height: 38,
                          padding: 0,
                          fontSize: '1.1rem',
                          lineHeight: 1,
                        }}
                      >
                        ?
                      </button>

                      <div
                        style={{
                          minWidth: 74,
                          textAlign: 'center',
                          fontSize: '1rem',
                          fontWeight: 800,
                          color: colors.text,
                        }}
                      >
                        {historyPickerYear}
                      </div>

                      <button
                        type="button"
                        aria-label="Next year"
                        disabled={
                          historyPickerYear >=
                          Number(selectedPeriod.slice(0, 4))
                        }
                        onClick={() =>
                          setHistoryPickerYear((year) =>
                            Math.min(
                              year + 1,
                              Number(selectedPeriod.slice(0, 4))
                            )
                          )
                        }
                        style={{
                          ...s.buttonSecondary,
                          width: 38,
                          height: 38,
                          padding: 0,
                          fontSize: '1.1rem',
                          lineHeight: 1,
                          opacity:
                            historyPickerYear >=
                            Number(selectedPeriod.slice(0, 4))
                              ? 0.45
                              : 1,
                          cursor:
                            historyPickerYear >=
                            Number(selectedPeriod.slice(0, 4))
                              ? 'not-allowed'
                              : 'pointer',
                        }}
                      >
                        ?
                      </button>
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns:
                        'repeat(4, minmax(0, 1fr))',
                      gap: '0.55rem',
                      marginTop: '1rem',
                    }}
                  >
                    {[
                      'January',
                      'February',
                      'March',
                      'April',
                      'May',
                      'June',
                      'July',
                      'August',
                      'September',
                      'October',
                      'November',
                      'December',
                    ].map((monthName, index) => {
                      const month = String(index + 1).padStart(2, '0');
                      const period = `${historyPickerYear}-${month}`;
                      const available = historyPeriods.includes(period);
                      const active = historyPeriod === period;
                      const isCurrent =
                        period === selectedPeriod;
                      const isFuture =
                        period > selectedPeriod;
                      const disabled =
                        !available || isCurrent || isFuture;

                      return (
                        <button
                          key={period}
                          type="button"
                          disabled={disabled}
                          aria-pressed={active}
                          onClick={() => {
                            setHistoryPeriod(period);
                            void loadHistory(period);
                          }}
                          style={{
                            padding: '0.78rem 0.55rem',
                            minHeight: 62,
                            border: `1px solid ${
                              active
                                ? colors.accent
                                : available
                                  ? colors.border
                                  : 'transparent'
                            }`,
                            borderRadius: 10,
                            background: active
                              ? 'linear-gradient(135deg, #dbeafe 0%, #eff6ff 100%)'
                              : available
                                ? 'linear-gradient(135deg, #ffffff 0%, #f8fbff 100%)'
                                : colors.hover,
                            color: active
                              ? colors.primary
                              : available
                                ? colors.text
                                : colors.muted,
                            fontSize: '0.82rem',
                            fontWeight: active
                              ? 800
                              : available
                                ? 700
                                : 600,
                            cursor: disabled
                              ? 'not-allowed'
                              : 'pointer',
                            opacity: disabled
                              ? 0.55
                              : 1,
                            boxShadow: active
                              ? '0 8px 20px rgba(22, 119, 200, 0.16)'
                              : available
                                ? '0 3px 10px rgba(18, 59, 93, 0.045)'
                                : 'none',
                            transform: active
                              ? 'translateY(-1px)'
                              : 'translateY(0)',
                            transition:
                              'background 180ms ease, border-color 180ms ease, transform 180ms ease, box-shadow 180ms ease',
                          }}
                        >
                          <div>{monthName.slice(0, 3)}</div>
                          <div
                            style={{
                              marginTop: 3,
                              fontSize: '0.68rem',
                              fontWeight: 600,
                              color: active
                                ? colors.accent
                                : colors.muted,
                            }}
                          >
                            {isCurrent
                              ? 'Current'
                              : isFuture
                                ? 'Future'
                                : available
                                  ? 'Available'
                                  : 'No record'}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {historyPeriod && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '0.75rem',
                        flexWrap: 'wrap',
                        marginTop: '0.85rem',
                        paddingTop: '0.75rem',
                        borderTop: `1px solid ${colors.border}`,
                      }}
                    >
                      <span style={s.muted}>
                        Selected:{' '}
                        <strong style={{ color: colors.text }}>
                          {new Date(
                            Number(historyPeriod.slice(0, 4)),
                            Number(historyPeriod.slice(5, 7)) - 1,
                            1
                          ).toLocaleDateString('en-US', {
                            month: 'long',
                            year: 'numeric',
                          })}
                        </strong>
                      </span>

                      <button
                        type="button"
                        onClick={() => {
                          setHistoryPeriod('');
                          setHistoryFees([]);
                        }}
                        style={{
                          ...s.buttonSecondary,
                          ...s.btnSmall,
                        }}
                      >
                        Clear selection
                      </button>
                    </div>
                  )}

                  {historyPeriods.length === 0 && (
                    <div
                      style={{
                        marginTop: '0.8rem',
                        padding: '0.75rem',
                        borderRadius: 8,
                        background: colors.card,
                        color: colors.muted,
                        fontSize: '0.82rem',
                      }}
                    >
                      No previous fee records are available yet.
                    </div>
                  )}
                </div>

                {historyLoading ? (
                  <p style={s.spinner}>Loading fee history...</p>
                ) : !historyPeriod ? (
                  <div style={s.empty}>
                    Select a previous month to view fee history.
                  </div>
                ) : historyFees.length === 0 ? (
                  <div style={s.empty}>
                    No fee records found for {historyPeriod}.
                  </div>
                ) : (
                  <div style={s.tableWrap}>
                    <table style={s.table}>
                      <thead>
                        <tr>
                          <th style={s.th}>Student</th>
                          <th style={s.th}>Roll No.</th>
                          <th style={s.th}>Period</th>
                          <th style={s.th}>Amount Due</th>
                          <th style={s.th}>Fine</th>
                          <th style={s.th}>Paid</th>
                          <th style={s.th}>Remaining</th>
                          <th style={s.th}>Status</th>
                        </tr>
                      </thead>

                      <tbody>
                        {historyFees.map((fee) => (
                          <tr key={fee.id}>
                            <td style={s.td}>{fee.studentName}</td>
                            <td style={s.td}>{fee.rollNumber}</td>
                            <td style={s.td}>{fee.feePeriod}</td>
                            <td style={s.td}>
                              {formatAmount(fee.amountDue)}
                            </td>
                            <td style={s.td}>
                              {formatAmount(fee.appliedFine)}
                            </td>
                            <td style={s.td}>
                              {formatAmount(fee.amountPaid)}
                            </td>
                            <td style={s.td}>
                              {formatAmount(fee.totalRemaining)}
                            </td>
                            <td style={s.td}>
                              <span
                                style={statusStyle(
                                  fee.effectiveStatus
                                )}
                              >
                                {statusLabel(
                                  fee.effectiveStatus
                                )}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            )}

            {receivePaymentWorkspaceOpen && (
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="receive-payment-title"
                style={{
                  position: 'fixed',
                  inset: 0,
                  zIndex: 1000,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '1.25rem',
                  background: 'rgba(15, 23, 42, 0.58)',
                  overflowY: 'auto',
                }}
              >
                <section
                  style={{
                    ...s.card,
                    width: 'min(1000px, 100%)',
                    maxHeight: 'calc(100vh - 2.5rem)',
                    overflowY: 'auto',
                    margin: 'auto',
                    borderRadius: 18,
                    border: `1px solid rgba(22,119,200,0.20)`,
                    background:
                      'linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)',
                    boxShadow:
                      '0 28px 80px rgba(15,23,42,0.30), 0 0 0 1px rgba(56,189,248,0.06)',
                  }}
                >
                <div style={s.between}>
                  <div>
                    <h2
                      id="receive-payment-title"
                      style={{
                        ...s.formTitle,
                        marginBottom: 4,
                        letterSpacing: -0.3,
                      }}
                    >
                      Receive Payment
                    </h2>
                    {receivePaymentMode === 'student' && receivePaymentStudent ? (
                      <p style={s.muted}>
                        {receivePaymentStudent.studentName} ? Roll{' '}
                        {receivePaymentStudent.rollNumber}
                        {receivePaymentStudent.guardianName
                          ? ` ? Guardian: ${receivePaymentStudent.guardianName}`
                          : ''}
                      </p>
                    ) : receivePaymentMode === 'family' && receivePaymentFamily ? (
                      <p style={s.muted}>
                        {receivePaymentFamilySummary?.guardianName ?? 'Family'} ?{' '}
                        {receivePaymentFamilySummary?.childrenCount ?? 0} children
                        {receivePaymentFamilySummary?.guardianPhone
                          ? ` ? ${receivePaymentFamilySummary.guardianPhone}`
                          : ''}
                      </p>
                    ) : (
                      <p style={s.muted}>
                        Select a student or family to continue.
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    style={{
                      ...s.btnSecondary,
                      borderRadius: 9,
                      fontWeight: 700,
                      transition:
                        'transform 160ms ease, box-shadow 160ms ease',
                    }}
                    onClick={closeReceivePayment}
                    onMouseEnter={e => {
                      e.currentTarget.style.transform = 'translateY(-1px)';
                      e.currentTarget.style.boxShadow =
                        '0 5px 12px rgba(15,23,42,0.10)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.transform = '';
                      e.currentTarget.style.boxShadow = '';
                    }}
                  >
                    Close
                  </button>
                </div>

                <div
                  style={{
                    display: 'flex',
                    gap: 8,
                    marginTop: '1rem',
                    padding: 5,
                    borderRadius: 12,
                    background:
                      'linear-gradient(135deg, #eef6ff 0%, #f8fafc 100%)',
                    border: `1px solid ${colors.border}`,
                    boxShadow: 'inset 0 1px 2px rgba(18,59,93,0.03)',
                  }}
                >
                  <button
                    type="button"
                    style={{
                      ...(receivePaymentMode === 'student'
                        ? s.btnPrimary
                        : s.btnSecondary),
                      flex: 1,
                    }}
                    onClick={() => {
                      setReceivePaymentMode('student');
                      setReceivePaymentFamilyId(null);
                      setReceivePaymentFamily(null);
                      setReceivePaymentFamilyResult(null);
                      setReceivePaymentAmount('');
                      setReceivePaymentConfirmed(false);
                      setError('');
                      setNotice('');
                    }}
                  >
                    Student Payment
                  </button>

                  <button
                    type="button"
                    style={{
                      ...(receivePaymentMode === 'family'
                        ? s.btnPrimary
                        : s.btnSecondary),
                      flex: 1,
                    }}
                    onClick={() => {
                      setReceivePaymentMode('family');
                      setReceivePaymentStudentId(null);
                      setReceivePaymentStudent(null);
                      setReceivePaymentAmount('');
                      setReceivePaymentConfirmed(false);
                      setError('');
                      setNotice('');
                    }}
                  >
                    Family Payment
                  </button>
                </div>

                {receivePaymentMode === 'family' && (
                  <div
                    style={{
                      marginTop: '1rem',
                      padding: '1rem',
                      borderRadius: 10,
                      border: `1px solid ${colors.border}`,
                      background: '#f8fafc',
                    }}
                  >
                    <label style={s.label}>Search Family</label>
                    <input
                      value={receivePaymentFamilySearch}
                      onChange={(event) =>
                        setReceivePaymentFamilySearch(event.target.value)
                      }
                      placeholder="Guardian, phone, child name or roll number"
                      className="soa-family-payment-search"
                      style={{
                        ...s.input,
                        borderRadius: 10,
                        transition:
                          'border-color 160ms ease, box-shadow 160ms ease',
                      }}
                    />

                    <div
                      style={{
                        display: 'grid',
                        gap: 8,
                        marginTop: 10,
                        maxHeight: 220,
                        overflowY: 'auto',
                      }}
                    >
                      {families
                        .filter((family) => {
                          const query = receivePaymentFamilySearch
                            .trim()
                            .toLowerCase();

                          if (!query) return true;

                          return [
                            family.guardianName,
                            family.guardianPhone,
                            ...family.children.flatMap((child) => [
                              child.fullName,
                              child.rollNumber,
                            ]),
                          ]
                            .filter(Boolean)
                            .some((value) =>
                              String(value)
                                .toLowerCase()
                                .includes(query),
                            );
                        })
                        .map((family) => (
                          <button
                            key={family.id}
                            type="button"
                            style={{
                              textAlign: 'left',
                              padding: '0.75rem',
                              borderRadius: 8,
                              border: `1px solid ${
                                receivePaymentFamilyId === family.id
                                  ? colors.primary
                                  : colors.border
                              }`,
                              background:
                                receivePaymentFamilyId === family.id
                                  ? '#eff6ff'
                                  : '#ffffff',
                              cursor: 'pointer',
                            }}
                            onClick={() =>
                              void loadReceivePaymentFamily(family.id)
                            }
                          >
                            <div style={{ fontWeight: 800 }}>
                              {family.guardianName || 'Family'}
                            </div>
                            <div style={s.muted}>
                              {family.children.length} children
                              {family.guardianPhone
                                ? ` ? ${family.guardianPhone}`
                                : ''}
                            </div>
                            <div style={s.muted}>
                              {family.children
                                .map(
                                  (child) =>
                                    `${child.fullName} (${child.rollNumber})`,
                                )
                                .join(', ')}
                            </div>
                          </button>
                        ))}

                      {families.length === 0 && (
                        <div style={s.empty}>
                          No families are available.
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {receivePaymentMode === 'student' &&
                  !receivePaymentStudent && (
                  <div
                    style={{
                      marginTop: '1rem',
                      padding: '1rem',
                      borderRadius: 10,
                      border: `1px solid ${colors.border}`,
                      background: '#f8fafc',
                    }}
                  >
                    <label style={s.label}>Search Student</label>
                    <input
                      value={studentFeeSearch}
                      onChange={(event) =>
                        setStudentFeeSearch(event.target.value)
                      }
                      placeholder="Student name, roll number or guardian"
                      style={s.input}
                      autoFocus
                    />

                    <div
                      style={{
                        display: 'grid',
                        gap: 8,
                        marginTop: 10,
                        maxHeight: 220,
                        overflowY: 'auto',
                      }}
                    >
                      {filteredStudentFeeStudents.map((student) => (
                        <button
                          key={student.id}
                          type="button"
                          style={{
                            ...s.btnSecondary,
                            textAlign: 'left',
                            padding: '0.75rem 1rem',
                          }}
                          onClick={() => {
                            setStudentFeeSearch('');
                            void loadReceivePaymentStudent(student.id);
                          }}
                        >
                          <strong>{student.fullName}</strong>
                          <div style={s.muted}>
                            Roll {student.rollNumber}
                            {student.guardianName
                              ? ` ? Guardian: ${student.guardianName}`
                              : ''}
                          </div>
                        </button>
                      ))}

                      {filteredStudentFeeStudents.length === 0 && (
                        <div style={s.empty}>
                          No matching students found.
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {receivePaymentMode === 'student' &&
                  receivePaymentStudent && (
                  <>
                {receivePaymentLoading ? (
                  <p style={{ ...s.spinner, marginTop: '1rem' }}>
                    Loading outstanding fees...
                  </p>
                ) : (
                  <>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns:
                          'repeat(3, minmax(0, 1fr))',
                        gap: 12,
                        marginTop: '1rem',
                      }}
                    >
                      <div
                        style={{
                          padding: 14,
                          border: `1px solid ${colors.border}`,
                          borderRadius: 10,
                          background: '#f8fafc',
                        }}
                      >
                        <div style={s.muted}>Total Outstanding</div>
                        <div
                          style={{
                            fontSize: '1.35rem',
                            fontWeight: 800,
                            marginTop: 4,
                          }}
                        >
                          {formatAmount(
                            receivePaymentStudent.totalOutstanding,
                          )}
                        </div>
                      </div>

                      <div
                        style={{
                          padding: 14,
                          border: `1px solid ${colors.border}`,
                          borderRadius: 10,
                          background: '#f8fafc',
                        }}
                      >
                        <div style={s.muted}>Outstanding Periods</div>
                        <div
                          style={{
                            fontSize: '1.35rem',
                            fontWeight: 800,
                            marginTop: 4,
                          }}
                        >
                          {receivePaymentStudent.fees.length}
                        </div>
                      </div>

                      <div
                        style={{
                          padding: 14,
                          border: `1px solid ${colors.border}`,
                          borderRadius: 10,
                          background: '#f8fafc',
                        }}
                      >
                        <div style={s.muted}>Allocation</div>
                        <div
                          style={{
                            fontWeight: 800,
                            marginTop: 7,
                          }}
                        >
                          Oldest Due First
                        </div>
                      </div>
                    </div>

                    <div style={{ marginTop: '1.25rem' }}>
                      <h3
                        style={{
                          ...s.formTitle,
                          marginBottom: '0.7rem',
                        }}
                      >
                        Outstanding Fee Periods
                      </h3>

                      {receivePaymentStudent.fees.length === 0 ? (
                        <div style={s.empty}>
                          No outstanding fees found for this student.
                        </div>
                      ) : (
                        <div style={s.tableWrap}>
                          <table style={s.table}>
                            <thead>
                              <tr>
                                <th style={s.th}>Period</th>
                                <th style={s.th}>Fee</th>
                                <th style={s.th}>Paid</th>
                                <th style={s.th}>Fine</th>
                                <th style={s.th}>Remaining</th>
                              </tr>
                            </thead>

                            <tbody>
                              {receivePaymentStudent.fees.map((fee) => (
                                <tr key={fee.studentFeeId}>
                                  <td style={s.td}>
                                    <strong>{fee.feePeriod}</strong>
                                  </td>
                                  <td style={s.td}>
                                    {formatAmount(fee.amountDue)}
                                  </td>
                                  <td style={s.td}>
                                    {formatAmount(fee.amountPaid)}
                                  </td>
                                  <td style={s.td}>
                                    {formatAmount(fee.effectiveFine)}
                                  </td>
                                  <td style={s.td}>
                                    <strong>
                                      {formatAmount(fee.remaining)}
                                    </strong>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

                    <div
                      style={{
                        marginTop: '1.25rem',
                        paddingTop: '1.25rem',
                        borderTop: `1px solid ${colors.border}`,
                      }}
                    >
                      <h3
                        style={{
                          ...s.formTitle,
                          marginBottom: '0.7rem',
                        }}
                      >
                        Payment Details
                      </h3>

                      <div style={s.row}>
                        <div style={{ ...s.field, flex: '0 1 180px' }}>
                          <label style={s.label}>
                            Payment Amount
                          </label>
                          <input
                            style={s.input}
                            type="number"
                            min="1"
                            max={receivePaymentStudent.totalOutstanding}
                            step="1"
                            value={receivePaymentAmount}
                            onChange={(event) =>
                              setReceivePaymentAmount(event.target.value)
                            }
                          />
                        </div>

                        <div style={{ ...s.field, flex: '0 1 170px' }}>
                          <label style={s.label}>Payment Date</label>
                          <input
                            style={s.input}
                            type="date"
                            value={receivePaymentDate}
                            onChange={(event) =>
                              setReceivePaymentDate(event.target.value)
                            }
                          />
                        </div>

                        <div style={{ ...s.field, flex: '0 1 170px' }}>
                          <label style={s.label}>Payment Method</label>
                          <select
                            style={s.select}
                            value={receivePaymentMethod}
                            onChange={(event) =>
                              setReceivePaymentMethod(
                                event.target.value as FeePayment['paymentMethod'],
                              )
                            }
                          >
                            <option value="cash">Cash</option>
                            <option value="bank">Bank</option>
                            <option value="online">Online</option>
                            <option value="other">Other</option>
                          </select>
                        </div>

                        <div style={{ ...s.field, flex: '1 1 260px' }}>
                          <label style={s.label}>
                            Notes (optional)
                          </label>
                          <input
                            style={s.input}
                            maxLength={500}
                            value={receivePaymentNotes}
                            onChange={(event) =>
                              setReceivePaymentNotes(event.target.value)
                            }
                            placeholder="Optional payment note"
                          />
                        </div>
                      </div>

                      {Number(receivePaymentAmount) > 0 &&
                        receivePaymentAllocationPreview.some(
                          (fee) => fee.allocation > 0,
                        ) && (
                          <div
                            style={{
                              marginTop: '1rem',
                              padding: '1rem',
                              borderRadius: 10,
                              border: `1px solid ${colors.border}`,
                              background: '#ffffff',
                            }}
                          >
                            <div
                              style={{
                                ...s.between,
                                marginBottom: '0.7rem',
                              }}
                            >
                              <div>
                                <h4
                                  style={{
                                    ...s.formTitle,
                                    marginBottom: 2,
                                  }}
                                >
                                  Allocation Preview
                                </h4>
                                <div style={s.muted}>
                                  Review how this payment will be applied.
                                </div>
                              </div>

                              <strong>
                                {formatAmount(
                                  Number(receivePaymentAmount) || 0,
                                )}
                              </strong>
                            </div>

                            <div style={s.tableWrap}>
                              <table style={s.table}>
                                <thead>
                                  <tr>
                                    <th style={s.th}>Period</th>
                                    <th style={s.th}>Outstanding</th>
                                    <th style={s.th}>Payment Applied</th>
                                    <th style={s.th}>After Payment</th>
                                  </tr>
                                </thead>

                                <tbody>
                                  {receivePaymentAllocationPreview
                                    .filter(
                                      (fee) => fee.allocation > 0,
                                    )
                                    .map((fee) => (
                                      <tr key={fee.studentFeeId}>
                                        <td style={s.td}>
                                          <strong>
                                            {fee.feePeriod}
                                          </strong>
                                        </td>

                                        <td style={s.td}>
                                          {formatAmount(fee.remaining)}
                                        </td>

                                        <td style={s.td}>
                                          <strong>
                                            {formatAmount(fee.allocation)}
                                          </strong>
                                        </td>

                                        <td style={s.td}>
                                          {formatAmount(
                                            fee.remaining -
                                              fee.allocation,
                                          )}
                                        </td>
                                      </tr>
                                    ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}

                      <div
                        style={{
                          marginTop: '1rem',
                          padding: '0.9rem 1rem',
                          borderRadius: 10,
                          background: '#f8fafc',
                          border: `1px solid ${colors.border}`,
                        }}
                      >
                        <div style={s.muted}>
                          Payment will be allocated automatically from the
                          oldest outstanding period to the newest.
                        </div>

                        <div
                          style={{
                            marginTop: 5,
                            fontWeight: 800,
                          }}
                        >
                          Amount to receive:{' '}
                          {formatAmount(
                            Number(receivePaymentAmount) || 0,
                          )}
                        </div>
                      </div>

                      {!receivePaymentConfirmed ? (
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'flex-end',
                            gap: 10,
                            marginTop: '1rem',
                          }}
                        >
                          <button
                            type="button"
                            style={s.btnSecondary}
                            onClick={closeReceivePayment}
                            disabled={saving}
                          >
                            Cancel
                          </button>

                          <button
                            type="button"
                            style={{
                              ...s.btnPrimary,
                              minWidth: 190,
                            }}
                            onClick={() => void createReceivePayment()}
                            disabled={
                              saving ||
                              !receivePaymentStudent ||
                              Number(receivePaymentAmount) < 1 ||
                              Number(receivePaymentAmount) >
                                (receivePaymentStudent?.totalOutstanding ?? 0)
                            }
                          >
                            {saving
                              ? 'Recording Payment...'
                              : 'Confirm & Record Payment'}
                          </button>
                        </div>
                      ) : (
                        <div
                          style={{
                            marginTop: '1rem',
                            padding: '1rem',
                            borderRadius: 10,
                            border: `1px solid ${colors.border}`,
                            background: '#f8fafc',
                          }}
                        >
                          <div
                            style={{
                              fontWeight: 800,
                              fontSize: '1.05rem',
                            }}
                          >
                            Payment Recorded Successfully
                          </div>

                          {receivePaymentResult && (
                            <div
                              style={{
                                marginTop: 8,
                                display: 'grid',
                                gap: 4,
                              }}
                            >
                              <div style={s.muted}>
                                Receipt Number:{' '}
                                <strong>
                                  {receivePaymentResult.receiptNumber}
                                </strong>
                              </div>

                              <div style={s.muted}>
                                Amount Received:{' '}
                                <strong>
                                  {formatAmount(
                                    receivePaymentResult.totalAmount,
                                  )}
                                </strong>
                              </div>

                              <div style={s.muted}>
                                Payment Method:{' '}
                                <strong>
                                  {receivePaymentResult.paymentMethod}
                                </strong>
                              </div>
                            </div>
                          )}

                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'flex-end',
                              gap: 10,
                              marginTop: '1rem',
                            }}
                          >
                            <button
                              type="button"
                              style={s.btnSecondary}
                              onClick={printProfessionalReceipt}
                            >
                              Print Receipt
                            </button>

                            <button
                              type="button"
                              style={s.btnSecondary}
                              onClick={closeReceivePayment}
                            >
                              Close Workspace
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}
                </>
                )}
                
                {receivePaymentMode === 'family' && (
                  <div style={{ marginTop: '1rem' }}>
                    {receivePaymentFamilyLoading ? (
                      <p style={{ ...s.spinner, marginTop: '1rem' }}>
                        Loading family outstanding fees...
                      </p>
                    ) : !receivePaymentFamily ? (
                      <div
                        style={{
                          padding: '1rem',
                          borderRadius: 10,
                          border: `1px dashed ${colors.border}`,
                          textAlign: 'center',
                          ...s.muted,
                        }}
                      >
                        Select a family above to load all children and
                        outstanding fees automatically.
                      </div>
                    ) : (
                      <>
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns:
                              'repeat(3, minmax(0, 1fr))',
                            gap: 12,
                          }}
                        >
                          <div
                            style={{
                              padding: 14,
                              border: `1px solid ${colors.border}`,
                              borderRadius: 10,
                              background: '#f8fafc',
                            }}
                          >
                            <div style={s.muted}>Family Outstanding</div>
                            <div
                              style={{
                                fontSize: '1.35rem',
                                fontWeight: 800,
                                marginTop: 4,
                              }}
                            >
                              {formatAmount(
                                receivePaymentFamily.totalOutstanding,
                              )}
                            </div>
                          </div>

                          <div
                            style={{
                              padding: 14,
                              border: `1px solid ${colors.border}`,
                              borderRadius: 10,
                              background: '#f8fafc',
                            }}
                          >
                            <div style={s.muted}>Children With Dues</div>
                            <div
                              style={{
                                fontSize: '1.35rem',
                                fontWeight: 800,
                                marginTop: 4,
                              }}
                            >
                              {
                                receivePaymentFamily.children.filter(
                                  (child) => child.totalOutstanding > 0,
                                ).length
                              }
                            </div>
                          </div>

                          <div
                            style={{
                              padding: 14,
                              border: `1px solid ${colors.border}`,
                              borderRadius: 10,
                              background: '#f8fafc',
                            }}
                          >
                            <div style={s.muted}>Allocation</div>
                            <div
                              style={{
                                fontSize: '1rem',
                                fontWeight: 800,
                                marginTop: 8,
                              }}
                            >
                              Oldest Due First
                            </div>
                          </div>
                        </div>

                        <div style={{ marginTop: '1rem' }}>
                          <h3 style={s.formTitle}>
                            Children & Outstanding Fees
                          </h3>

                          <div style={s.tableWrap}>
                            <table style={s.table}>
                              <thead>
                                <tr>
                                  <th style={s.th}>Child</th>
                                  <th style={s.th}>Roll No.</th>
                                  <th style={s.th}>Class</th>
                                  <th style={s.th}>Period</th>
                                  <th style={s.th}>Outstanding</th>
                                </tr>
                              </thead>
                              <tbody>
                                {receivePaymentFamily.children.flatMap(
                                  (child) =>
                                    child.fees.map((fee) => (
                                      <tr
                                        key={`${child.studentId}-${fee.studentFeeId}`}
                                      >
                                        <td style={s.td}>
                                          {child.studentName}
                                        </td>
                                        <td style={s.td}>
                                          {child.rollNumber}
                                        </td>
                                        <td style={s.td}>
                                          {child.className}
                                        </td>
                                        <td style={s.td}>
                                          {fee.feePeriod}
                                        </td>
                                        <td style={s.td}>
                                          {formatAmount(fee.remaining)}
                                        </td>
                                      </tr>
                                    )),
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        <div
                          style={{
                            marginTop: '1rem',
                            padding: '1rem',
                            borderRadius: 10,
                            border: `1px solid ${colors.border}`,
                            background: '#ffffff',
                          }}
                        >
                          <h3 style={s.formTitle}>
                            Payment Details
                          </h3>

                          <div
                            style={{
                              display: 'grid',
                              gridTemplateColumns:
                                'repeat(2, minmax(0, 1fr))',
                              gap: 12,
                            }}
                          >
                            <div>
                              <label style={s.label}>
                                Amount to Receive
                              </label>
                              <input
                                type="number"
                                min="1"
                                step="1"
                                value={receivePaymentAmount}
                                onChange={(event) =>
                                  setReceivePaymentAmount(
                                    event.target.value,
                                  )
                                }
                                style={s.input}
                              />
                            </div>

                            <div>
                              <label style={s.label}>
                                Payment Date
                              </label>
                              <input
                                type="date"
                                value={receivePaymentDate}
                                onChange={(event) =>
                                  setReceivePaymentDate(
                                    event.target.value,
                                  )
                                }
                                style={s.input}
                              />
                            </div>

                            <div>
                              <label style={s.label}>
                                Payment Method
                              </label>
                              <select
                                value={receivePaymentMethod}
                                onChange={(event) =>
                                  setReceivePaymentMethod(
                                    event.target.value as FeePayment['paymentMethod'],
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

                            <div>
                              <label style={s.label}>
                                Notes
                              </label>
                              <input
                                value={receivePaymentNotes}
                                onChange={(event) =>
                                  setReceivePaymentNotes(
                                    event.target.value,
                                  )
                                }
                                maxLength={500}
                                placeholder="Optional note"
                                style={s.input}
                              />
                            </div>
                          </div>
                        </div>

                        <div
                          style={{
                            marginTop: '1rem',
                            padding: '1rem',
                            borderRadius: 10,
                            background: '#f8fafc',
                            border: `1px solid ${colors.border}`,
                          }}
                        >
                          <div
                            style={{
                              fontWeight: 800,
                              marginBottom: 8,
                            }}
                          >
                            Automatic Allocation Preview
                          </div>

                          <div style={s.tableWrap}>
                            <table style={s.table}>
                              <thead>
                                <tr>
                                  <th style={s.th}>Child</th>
                                  <th style={s.th}>Period</th>
                                  <th style={s.th}>Outstanding</th>
                                  <th style={s.th}>Applied</th>
                                  <th style={s.th}>After Payment</th>
                                </tr>
                              </thead>
                              <tbody>
                                {receivePaymentFamilyAllocationPreview
                                  .filter(
                                    (fee) => fee.allocation > 0,
                                  )
                                  .map((fee) => (
                                    <tr
                                      key={`allocation-${fee.studentFeeId}`}
                                    >
                                      <td style={s.td}>
                                        {fee.studentName}
                                      </td>
                                      <td style={s.td}>
                                        {fee.feePeriod}
                                      </td>
                                      <td style={s.td}>
                                        {formatAmount(fee.remaining)}
                                      </td>
                                      <td style={s.td}>
                                        <strong>
                                          {formatAmount(
                                            fee.allocation,
                                          )}
                                        </strong>
                                      </td>
                                      <td style={s.td}>
                                        {formatAmount(
                                          fee.remaining -
                                            fee.allocation,
                                        )}
                                      </td>
                                    </tr>
                                  ))}
                              </tbody>
                            </table>
                          </div>

                          <div
                            style={{
                              marginTop: 10,
                              fontWeight: 800,
                            }}
                          >
                            Amount to receive:{' '}
                            {formatAmount(
                              Number(receivePaymentAmount) || 0,
                            )}
                          </div>
                        </div>

                        {!receivePaymentConfirmed ? (
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'flex-end',
                              gap: 10,
                              marginTop: '1rem',
                            }}
                          >
                            <button
                              type="button"
                              style={s.btnSecondary}
                              onClick={closeReceivePayment}
                              disabled={saving}
                            >
                              Cancel
                            </button>

                            <button
                              type="button"
                              style={{
                                ...s.btnPrimary,
                                minWidth: 210,
                              }}
                              onClick={() =>
                                void createReceiveFamilyPayment()
                              }
                              disabled={
                                saving ||
                                Number(receivePaymentAmount) < 1 ||
                                Number(receivePaymentAmount) >
                                  receivePaymentFamily.totalOutstanding
                              }
                            >
                              {saving
                                ? 'Recording Family Payment...'
                                : 'Confirm Family Payment'}
                            </button>
                          </div>
                        ) : (
                          <div
                            style={{
                              marginTop: '1rem',
                              padding: '1rem',
                              borderRadius: 10,
                              border: `1px solid ${colors.border}`,
                              background: '#f8fafc',
                            }}
                          >
                            <div
                              style={{
                                fontWeight: 800,
                                fontSize: '1.05rem',
                              }}
                            >
                              Family Payment Recorded Successfully
                            </div>

                            {receivePaymentFamilyResult && (
                              <div
                                style={{
                                  marginTop: 8,
                                  display: 'grid',
                                  gap: 4,
                                }}
                              >
                                <div style={s.muted}>
                                  Receipt Number:{' '}
                                  <strong>
                                    {
                                      receivePaymentFamilyResult.receiptNumber
                                    }
                                  </strong>
                                </div>

                                <div style={s.muted}>
                                  Amount Received:{' '}
                                  <strong>
                                    {formatAmount(
                                      receivePaymentFamilyResult.totalAmount,
                                    )}
                                  </strong>
                                </div>

                                <div style={s.muted}>
                                  Payment Method:{' '}
                                  <strong>
                                    {
                                      receivePaymentFamilyResult.paymentMethod
                                    }
                                  </strong>
                                </div>
                              </div>
                            )}

                            <div
                              style={{
                                display: 'flex',
                                justifyContent: 'flex-end',
                                marginTop: '1rem',
                              }}
                            >
                              <div
                                style={{
                                  display: 'flex',
                                  justifyContent: 'flex-end',
                                  gap: 8,
                                  marginTop: '1rem',
                                }}
                              >
                                <button
                                  type="button"
                                  style={s.btnSecondary}
                                  onClick={printProfessionalFamilyReceipt}
                                >
                                  Print Receipt
                                </button>

                                <button
                                  type="button"
                                  style={s.btnSecondary}
                                  onClick={closeReceivePayment}
                                >
                                  Close Workspace
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                </section>
              </div>
            )}

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
                      Receive Payment -{' '}
                      {selectedFee.studentName}
                    </h2>

                    <span style={s.muted}>
                      {selectedFee.rollNumber} ·{' '}
                      {selectedFee.feePeriod} ·
                      {' Total Remaining '}
                      {formatAmount(
                        selectedFee.totalRemaining
                      )}
                    </span>
                  </div>

                  <span
                    style={statusStyle(
                      selectedFee.effectiveStatus
                    )}
                  >
                    {statusLabel(selectedFee.effectiveStatus)}
                  </span>
                </div>

                <div
                  style={{
                    ...s.row,
                    marginTop: '0.8rem',
                  }}
                >
                  <div style={s.muted}>
                    Fee Due: {formatAmount(selectedFee.amountDue)}
                  </div>

                  <div style={s.muted}>
                    Paid: {formatAmount(selectedFee.amountPaid)}
                  </div>

                  <div style={s.muted}>
                    Fine: {formatAmount(selectedFee.appliedFine)}
                    {selectedFee.fineApplicable
                      ? ' (Applied)'
                      : ''}
                  </div>

                  <div style={s.muted}>
                    Total Payable:{' '}
                    {formatAmount(selectedFee.totalPayable)}
                  </div>

                  <div style={s.muted}>
                    Total Remaining:{' '}
                    {formatAmount(selectedFee.totalRemaining)}
                  </div>
                </div>

                {lastPayment && (
  <div
    style={{
      marginTop: '1rem',
      padding: '1rem 1.1rem',
      border: `1px solid ${colors.border}`,
      borderRadius: 10,
      background: '#f8fafc',
    }}
  >
    <div style={s.between}>
      <div>
        <div
          style={{
            fontWeight: 700,
            fontSize: '1.05rem',
          }}
        >
          Payment Received
        </div>

        <div style={s.muted}>
          Receipt #{lastPayment.receiptNumber}
        </div>
      </div>

      <span style={s.okText}>
        {formatAmount(lastPayment.amount)}
      </span>
    </div>

    <div
      style={{
        ...s.row,
        marginTop: '0.8rem',
      }}
    >
      <button
        type="button"
        style={s.btn}
        onClick={() => printReceipt(lastPayment)}
      >
        Print Receipt
      </button>

      <button
        type="button"
        style={s.btnSecondary}
        onClick={() => setLastPayment(null)}
      >
        Done
      </button>
    </div>
  </div>
)}

{selectedFee.appliedFine > 0 && (
                  <div
                    style={{
                      marginTop: '1rem',
                      padding: '1rem',
                      border: `1px solid ${colors.border}`,
                      borderRadius: 10,
                      background: '#f8fafc',
                    }}
                  >
                    {(() => {
                      const configuredFine = Number(
                        selectedFee.fineAmount ?? selectedFee.appliedFine
                      );
                      const alreadyWaived = Math.min(
                        configuredFine,
                        Math.max(
                          0,
                          Number(selectedFee.fineWaivedAmount ?? 0)
                        )
                      );
                      const remainingWaiverable = Math.max(
                        0,
                        configuredFine - alreadyWaived
                      );

                      return (
                        <>
                          <div style={s.between}>
                            <div>
                              <div style={{ fontWeight: 700 }}>
                                Fine Waiver
                              </div>
                              <div
                                style={{
                                  ...s.muted,
                                  marginTop: 4,
                                }}
                              >
                                Waiver requires an authorized reason and is
                                recorded in the payment audit trail.
                              </div>
                            </div>

                            <span
                              style={
                                remainingWaiverable > 0
                                  ? s.muted
                                  : s.okText
                              }
                            >
                              {remainingWaiverable > 0
                                ? 'Waiver Available'
                                : 'Fully Waived'}
                            </span>
                          </div>

                          <div
                            style={{
                              display: 'grid',
                              gridTemplateColumns:
                                'repeat(3, minmax(0, 1fr))',
                              gap: 10,
                              marginTop: '0.9rem',
                            }}
                          >
                            <div
                              style={{
                                padding: 10,
                                border: `1px solid ${colors.border}`,
                                borderRadius: 8,
                                background: colors.card,
                              }}
                            >
                              <div style={s.muted}>
                                Configured Fine
                              </div>
                              <div
                                style={{
                                  fontWeight: 800,
                                  marginTop: 3,
                                }}
                              >
                                {formatAmount(configuredFine)}
                              </div>
                            </div>

                            <div
                              style={{
                                padding: 10,
                                border: `1px solid ${colors.border}`,
                                borderRadius: 8,
                                background: colors.card,
                              }}
                            >
                              <div style={s.muted}>
                                Already Waived
                              </div>
                              <div
                                style={{
                                  fontWeight: 800,
                                  marginTop: 3,
                                }}
                              >
                                {formatAmount(alreadyWaived)}
                              </div>
                            </div>

                            <div
                              style={{
                                padding: 10,
                                border: `1px solid ${colors.border}`,
                                borderRadius: 8,
                                background: colors.card,
                              }}
                            >
                              <div style={s.muted}>
                                Remaining Waiverable
                              </div>
                              <div
                                style={{
                                  fontWeight: 800,
                                  marginTop: 3,
                                }}
                              >
                                {formatAmount(remainingWaiverable)}
                              </div>
                            </div>
                          </div>

                          {selectedFee.fineWaivedReason && (
                            <div
                              style={{
                                marginTop: '0.7rem',
                                padding: '0.65rem 0.8rem',
                                borderRadius: 8,
                                background: colors.card,
                                border: `1px solid ${colors.border}`,
                                fontSize: '0.9rem',
                                color: '#475569',
                              }}
                            >
                              <strong>Latest waiver reason:</strong>{' '}
                              {selectedFee.fineWaivedReason}
                            </div>
                          )}

                          {remainingWaiverable > 0 && (
                            <div
                              style={{
                                ...s.row,
                                marginTop: '0.8rem',
                              }}
                            >
                              <div
                                style={{
                                  ...s.field,
                                  flex: '0 1 180px',
                                }}
                              >
                                <label style={s.label}>
                                  Waive Amount *
                                </label>

                                <input
                                  style={s.input}
                                  type="number"
                                  min="1"
                                  max={remainingWaiverable}
                                  step="1"
                                  value={fineWaiveForm.amount}
                                  onChange={(event) =>
                                    setFineWaiveForm((current) => ({
                                      ...current,
                                      amount: event.target.value,
                                    }))
                                  }
                                />
                              </div>

                              <div
                                style={{
                                  ...s.field,
                                  flex: '1 1 260px',
                                }}
                              >
                                <label style={s.label}>
                                  Reason *
                                </label>

                                <input
                                  style={s.input}
                                  value={fineWaiveForm.reason}
                                  onChange={(event) =>
                                    setFineWaiveForm((current) => ({
                                      ...current,
                                      reason: event.target.value,
                                    }))
                                  }
                                  maxLength={500}
                                  placeholder="Enter reason for this waiver"
                                />
                              </div>

                              <button
                                style={s.btn}
                                type="button"
                                disabled={saving}
                                onClick={() => void waiveFine()}
                              >
                                {saving
                                  ? 'Saving...'
                                  : 'Waive Fine'}
                              </button>
                            </div>
                          )}

                          {remainingWaiverable <= 0 && (
                            <div
                              style={{
                                marginTop: '0.8rem',
                                padding: '0.7rem 0.8rem',
                                borderRadius: 8,
                                background: colors.card,
                                border: `1px solid ${colors.border}`,
                                color: '#475569',
                              }}
                            >
                              The configured fine has been fully waived.
                              No further waiver is available.
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                )}

                {selectedFee.totalRemaining > 0 ? (
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
                            selectedFee.totalRemaining
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
                          style={{
                            ...s.input,
                            background: '#f1f5f9',
                            color: '#475569',
                            cursor: 'not-allowed',
                          }}
                          value="Auto"
                          readOnly
                          title="Receipt number is generated automatically"
                        />
                      </div>

                      <button
                        style={s.btn}
                        type="submit"
                        disabled={saving}
                      >
                        {saving
                          ? 'Saving...'
                          : 'Receive Payment'}
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
            <th style={s.th}>Received By</th>
            <th style={s.th}>Action</th>
          </tr>
        </thead>

        <tbody>
          {payments.map((payment) => (
            <tr key={payment.id}>
              <td style={s.td}>
                {payment.paymentDate}
              </td>

              <td style={s.td}>
                {formatAmount(payment.amount)}
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

              <td style={s.td}>
                <button
                  type="button"
                  style={{
                    ...s.btnSecondary,
                    ...s.btnSmall,
                  }}
                  onClick={() => printReceipt(payment)}
                >
                  Print Receipt
                </button>
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



