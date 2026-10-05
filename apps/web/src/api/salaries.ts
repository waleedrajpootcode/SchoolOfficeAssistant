import type {
  TeacherSalary,
  CreateTeacherSalaryRequest,
  UpdateTeacherSalaryRequest,
} from '@school/shared';

import { api } from './client.js';

export const salariesApi = {
  list: (params?: { teacherId?: number; period?: string }) => {
    const search = new URLSearchParams();

    if (params?.teacherId !== undefined) {
      search.set('teacherId', String(params.teacherId));
    }

    if (params?.period) {
      search.set('period', params.period);
    }

    const query = search.toString();

    return api.get<TeacherSalary[]>(
      `/salaries${query ? `?${query}` : ''}`
    );
  },

  create: (body: CreateTeacherSalaryRequest) =>
    api.post<TeacherSalary>('/salaries', body),

  update: (id: number, body: UpdateTeacherSalaryRequest) =>
    api.patch<TeacherSalary>(`/salaries/${id}`, body),
};
