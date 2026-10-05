import type {
  CreateFamilyPaymentRequest,
  FamilyPaymentResult,
} from '@school/shared';
import { api } from './client';

export const familyPaymentsApi = {
  create: (body: CreateFamilyPaymentRequest) =>
    api.post<FamilyPaymentResult>('/family-payments', body),

  outstanding: (familyId: number) =>
    api.get<{
      familyId: number;
      children: Array<{
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
      }>;
      totalOutstanding: number;
    }>(`/family-payments/family/${familyId}/outstanding`),
};
