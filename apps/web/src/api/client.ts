/**
 * Minimal fetch wrapper for the School Office Assistant API.
 *
 * - All requests go to /api (proxied to the Fastify server by Vite in dev).
 * - credentials: 'include' sends the HttpOnly session cookie automatically.
 * - Returns typed ApiResponse<T> — never throws on HTTP errors,
 *   always returns { success, data?, error? }.
 */

import type { ApiResponse } from '@school/shared';

const BASE = '/api';

/** Extra fields attached to responses when the network itself failed. */
export type ApiResult<T> = ApiResponse<T> & { offline?: boolean };

async function request<T>(
  method: string,
  path: string,
  body?: unknown
): Promise<ApiResult<T>> {
  const init: RequestInit = {
    method,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
  };

  if (body !== undefined) {
    init.body = JSON.stringify(body);
  }

  try {
    const res = await fetch(`${BASE}${path}`, init);
    const json = (await res.json()) as ApiResponse<T>;
    return json;
  } catch {
    // Network failure (server unreachable / offline) — distinct from an
    // HTTP error response above.
    return { success: false, error: 'Network error — server may be offline', offline: true };
  }
}

export const api = {
  get:    <T>(path: string)                => request<T>('GET',    path),
  post:   <T>(path: string, body: unknown) => request<T>('POST',   path, body),
  patch:  <T>(path: string, body: unknown) => request<T>('PATCH',  path, body),
  delete: <T>(path: string)                => request<T>('DELETE', path),
};
