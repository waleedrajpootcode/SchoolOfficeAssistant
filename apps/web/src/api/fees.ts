import type {
  FeeStructure,
  CreateFeeStructureRequest,
  StudentFee,
  CreateStudentFeeRequest,
  FeePayment,
  CreateFeePaymentRequest,
  FeeSummary,
} from '@school/shared';

import { api } from './client.js';

export const feesApi = {
  // â”€â”€ Fee summary â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  getSummary: (period?: string) => {
    const query = period
      ? `?period=${encodeURIComponent(period)}`
      : '';

    return api.get<FeeSummary>(
      `/fees/summary${query}`
    );
  },

  // â”€â”€ Fee structures â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  listStructures: () =>
    api.get<FeeStructure[]>('/fees/structures'),

  createStructure: (body: CreateFeeStructureRequest) =>
    api.post<FeeStructure>('/fees/structures', body),

  // â”€â”€ Student fees â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  listStudentFees: (params?: {
    studentId?: number;
    period?: string;
    status?: string;
  }) => {
    const search = new URLSearchParams();

    if (params?.studentId !== undefined) {
      search.set('studentId', String(params.studentId));
    }

    if (params?.period) {
      search.set('period', params.period);
    }

    if (params?.status) {
      search.set('status', params.status);
    }

    const query = search.toString();

    return api.get<StudentFee[]>(
      `/fees/student-fees${query ? `?${query}` : ''}`
    );
  },

  listStudentFeePeriods: () =>
    api.get<string[]>('/fees/student-fee-periods'),

  createStudentFee: (body: CreateStudentFeeRequest) =>
    api.post<StudentFee>('/fees/student-fees', body),

  // â”€â”€ Payments â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  createPayment: (body: CreateFeePaymentRequest) =>
    api.post<FeePayment>('/fees/payments', body),

  getStudentOutstanding: (studentId: number) =>
    api.get<{
      studentId: number;
      studentName: string;
      rollNumber: string;
      guardianName: string;
      totalOutstanding: number;
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
    }>(`/fees/students/${studentId}/outstanding`),

  createStudentPayment: (body: {
    studentId: number;
    amount: number;
    paymentDate: string;
    paymentMethod: FeePayment['paymentMethod'];
    notes?: string | null;
  }) =>
    api.post<{
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
    }>('/fees/student-payments', body),

  listPayments: (studentFeeId: number) =>
    api.get<FeePayment[]>(`/fees/student-fees/${studentFeeId}/payments`),
};



