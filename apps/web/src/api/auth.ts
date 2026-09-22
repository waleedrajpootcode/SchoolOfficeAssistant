import type { LoginRequest, LoginResponse, UserSummary } from '@school/shared';
import { api } from './client.js';

export const authApi = {
  login: (body: LoginRequest) =>
    api.post<LoginResponse>('/auth/login', body),

  logout: () =>
    api.post<void>('/auth/logout', {}),

  me: () =>
    api.get<{ user: UserSummary }>('/auth/me'),
};
