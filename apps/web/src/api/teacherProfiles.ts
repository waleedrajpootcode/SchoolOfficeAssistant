import type {
  TeacherProfile,
  CreateTeacherProfileRequest,
  UpdateTeacherProfileRequest,
} from '@school/shared';

import { api } from './client.js';

export const teacherProfilesApi = {
  get: (teacherId: number) =>
    api.get<TeacherProfile>(`/teacher-profiles/${teacherId}`),

  create: (teacherId: number, body: CreateTeacherProfileRequest) =>
    api.post<TeacherProfile>(`/teacher-profiles/${teacherId}`, body),

  update: (teacherId: number, body: UpdateTeacherProfileRequest) =>
    api.patch<TeacherProfile>(`/teacher-profiles/${teacherId}`, body),
};
