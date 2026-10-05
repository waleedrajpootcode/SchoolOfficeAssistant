// @school/shared
// Shared types and utilities used by both web and server packages.
// Add domain types, enums, and validation schemas here as the project grows.

export * from './types.js';
export * from './validate.js';


export interface FamilyPaymentItem {
  studentFeeId: number;
  amount: number;
}

export interface CreateFamilyPaymentRequest {
  familyId: number;
  paymentDate: string;
  paymentMethod: 'cash' | 'bank' | 'online' | 'other';
  items: FamilyPaymentItem[];
  notes?: string | null;
}

export interface FamilyPaymentResult {
  batchId: number;
  familyId: number;
  receiptNumber: string;
  totalAmount: number;
  paymentDate: string;
  paymentMethod: string;
  payments: Array<{
    paymentId: number;
    studentFeeId: number;
    studentId: number;
    studentName: string;
    amount: number;
  }>;
}
