import type {
  StudentSummary, CreateStudentRequest, UpdateStudentRequest,
} from '@school/shared';
import { api } from './client.js';

export const studentsApi = {
  list:       (classId?: number) =>
    api.get<StudentSummary[]>('/students' + (classId ? `?classId=${classId}` : '')),
  create:     (body: CreateStudentRequest)  => api.post<StudentSummary>('/students', body),
  update:     (id: number, body: UpdateStudentRequest) => api.patch<StudentSummary>(`/students/${id}`, body),
  deactivate: (id: number)                  => api.delete<void>(`/students/${id}`),
};
