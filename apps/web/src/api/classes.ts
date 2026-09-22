import type {
  ClassSummary, CreateClassRequest, UpdateClassRequest,
} from '@school/shared';
import { api } from './client.js';

export const classesApi = {
  list:       ()                          => api.get<ClassSummary[]>('/classes'),
  listMine:   ()                          => api.get<ClassSummary[]>('/classes/mine'),
  create:     (body: CreateClassRequest)  => api.post<ClassSummary>('/classes', body),
  update:     (id: number, body: UpdateClassRequest) => api.patch<ClassSummary>(`/classes/${id}`, body),
  deactivate: (id: number)                => api.delete<void>(`/classes/${id}`),
};
