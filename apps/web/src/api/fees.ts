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
  // ── Fee summary ───────────────────────────────────────────────────────────
  getSummary: () =>
    api.get<FeeSummary>('/fees/summary'),

  // ── Fee structures ────────────────────────────────────────────────────────
  listStructures: () =>
    api.get<FeeStructure[]>('/fees/structures'),

  createStructure: (body: CreateFeeStructureRequest) =>
    api.post<FeeStructure>('/fees/structures', body),

  // ── Student fees ─────────────────────────────────────────────────────────
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

  createStudentFee: (body: CreateStudentFeeRequest) =>
    api.post<StudentFee>('/fees/student-fees', body),

  // ── Payments ─────────────────────────────────────────────────────────────
  createPayment: (body: CreateFeePaymentRequest) =>
    api.post<FeePayment>('/fees/payments', body),

  listPayments: (studentFeeId: number) =>
    api.get<FeePayment[]>(`/fees/student-fees/${studentFeeId}/payments`),
};