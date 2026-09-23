import type {
  CreateUserRequest,
  UpdateUserRequest,
  UserSummary,
} from '@school/shared';
import { api } from './client.js';

export const usersApi = {
  list: () => api.get<UserSummary[]>('/users'),

  create: (body: CreateUserRequest) =>
    api.post<UserSummary>('/users', body),

  update: (id: number, body: UpdateUserRequest) =>
    api.patch<UserSummary>(`/users/${id}`, body),

  deactivate: (id: number) =>
    api.delete<void>(`/users/${id}`),
};