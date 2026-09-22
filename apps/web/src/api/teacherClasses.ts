import type {
  TeacherClassAssignment, CreateTeacherClassRequest,
} from '@school/shared';
import { api } from './client.js';

export const teacherClassesApi = {
  list:       ()                                => api.get<TeacherClassAssignment[]>('/teacher-classes'),
  listMine:   ()                                => api.get<TeacherClassAssignment[]>('/teacher-classes/mine'),
  create:     (body: CreateTeacherClassRequest) => api.post<TeacherClassAssignment>('/teacher-classes', body),
  remove:     (teacherId: number, classId: number) =>
    api.delete<void>(`/teacher-classes/${teacherId}/${classId}`),
};
