import type {
  StudentFeeAssignment,
  CreateStudentFeeAssignmentRequest,
  UpdateStudentFeeAssignmentRequest,
} from '@school/shared';

import { api } from './client.js';

export const studentFeeAssignmentsApi = {
  list: (params?: {
    studentId?: number;
    activeOnly?: boolean;
  }) => {
    const search = new URLSearchParams();

    if (params?.studentId !== undefined) {
      search.set('studentId', String(params.studentId));
    }

    if (params?.activeOnly !== undefined) {
      search.set('activeOnly', String(params.activeOnly));
    }

    const query = search.toString();

    return api.get<StudentFeeAssignment[]>(
      `/student-fee-assignments${query ? `?${query}` : ''}`
    );
  },

  create: (body: CreateStudentFeeAssignmentRequest) =>
    api.post<StudentFeeAssignment>('/student-fee-assignments', body),

  update: (
    id: number,
    body: UpdateStudentFeeAssignmentRequest
  ) =>
    api.patch<StudentFeeAssignment>(
      `/student-fee-assignments/${id}`,
      body
    ),

  delete: (id: number) =>
    api.delete<void>(`/student-fee-assignments/${id}`),
};
