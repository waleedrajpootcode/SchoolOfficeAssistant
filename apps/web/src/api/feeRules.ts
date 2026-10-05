import type {
  CreateFeeRuleRequest,
  FeeRule,
  UpdateFeeRuleRequest,
} from '@school/shared';

const API_BASE = '/api/fee-rules';

async function parseResponse<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      typeof data?.error === 'string'
        ? data.error
        : `Request failed with status ${response.status}`
    );
  }

  return data as T;
}

export const feeRulesApi = {
  async list(): Promise<FeeRule[]> {
    const response = await fetch(API_BASE, {
      credentials: 'include',
    });

    const data = await parseResponse<{ success: boolean; data: FeeRule[] }>(response);
    return Array.isArray(data.data) ? data.data : [];
  },

  async create(payload: CreateFeeRuleRequest): Promise<FeeRule> {
    const response = await fetch(API_BASE, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await parseResponse<{ rule: FeeRule }>(response);
    return data.rule;
  },

  async update(
    id: number,
    payload: UpdateFeeRuleRequest
  ): Promise<FeeRule> {
    const response = await fetch(`${API_BASE}/${id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await parseResponse<{ rule: FeeRule }>(response);
    return data.rule;
  },

  async remove(id: number): Promise<void> {
    const response = await fetch(`${API_BASE}/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });

    await parseResponse<{ ok: boolean }>(response);
  },
};
