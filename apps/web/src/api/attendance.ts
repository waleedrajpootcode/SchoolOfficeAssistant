import type {
  AttendanceQuery,
  AttendanceRecord,
  StudentSummary,
  SubmitAttendanceRequest,
} from '@school/shared';
import { api } from './client.js';

export const attendanceApi = {
  get: (q: AttendanceQuery) =>
    api.get<AttendanceRecord[]>(`/attendance?classId=${q.classId}&attendanceDate=${encodeURIComponent(q.attendanceDate)}`),

  submit: (body: SubmitAttendanceRequest) =>
    api.post<AttendanceRecord[]>('/attendance', body),

  roster: (classId: number) =>
    api.get<StudentSummary[]>(`/classes/${classId}/roster`),
};