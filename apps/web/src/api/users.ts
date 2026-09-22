import type { UserSummary } from '@school/shared';
import { api } from './client.js';

export const usersApi = {
  list: () => api.get<UserSummary[]>('/users'),
};