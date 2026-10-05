import type { ApiResponse } from '@school/shared';

export interface ParentAlert {
  id: string;
  type: 'fee' | 'absence';
  studentId: number;
  studentName: string;
  rollNumber: string;
  guardianName: string;
  guardianPhone: string;
  className: string;
  message: string;
  feePeriod: string | null;
  amountRemaining: number | null;
  dueDate: string | null;
  fineStartDate: string | null;
  fineAmount: number | null;
  appliedFine: number | null;
  totalPayable: number | null;
  totalRemaining: number | null;
  daysOverdue: number | null;
  attendanceDate: string | null;
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    credentials: 'include',
    ...options,
  });

  const body = (await response.json()) as T & { message?: string };

  if (!response.ok) {
    throw new Error(body.message || `Request failed: ${response.status}`);
  }

  return body;
}

export const parentAlertsApi = {
  async list(): Promise<ParentAlert[]> {
    const result = await request<ApiResponse<ParentAlert[]>>(
      '/api/parent-alerts'
    );

    if (!result.success || !result.data) {
      throw new Error('Unable to load parent alerts.');
    }

    return result.data;
  },
};
