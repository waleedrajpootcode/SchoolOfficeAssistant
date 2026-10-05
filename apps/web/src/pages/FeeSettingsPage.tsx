import React from 'react';
import type {
  FeeRule,
  CreateFeeRuleRequest,
  UpdateFeeRuleRequest,
} from '@school/shared';
import { feeRulesApi } from '../api/feeRules';
import { api } from '../api/client.js';
import { colors } from '../styles/shared.js';

interface FeeStructure {
  id: number;
  classId: number;
  className: string;
  feeName: string;
  amount: number;
  isActive: boolean;
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    display: 'grid',
    gap: 20,
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 16,
    flexWrap: 'wrap',
  },
  title: {
    margin: 0,
    color: colors.text,
    fontSize: 28,
  },
  subtitle: {
    margin: '6px 0 0',
    color: colors.muted,
  },
  card: {
    background: colors.card,
    border: `1px solid ${colors.border}`,
    borderRadius: 16,
    padding: 20,
    boxShadow: '0 8px 24px rgba(15, 23, 42, 0.05)',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: 14,
  },
  field: {
    display: 'grid',
    gap: 7,
  },
  label: {
    fontSize: 13,
    fontWeight: 700,
    color: colors.text,
  },
  input: {
    width: '100%',
    boxSizing: 'border-box',
    padding: '10px 12px',
    borderRadius: 10,
    border: `1px solid ${colors.border}`,
    background: colors.background,
    color: colors.text,
    fontSize: 14,
  },
  helper: {
    fontSize: 12,
    color: colors.muted,
  },
  actions: {
    display: 'flex',
    gap: 10,
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: 16,
  },
  primary: {
    border: 0,
    borderRadius: 10,
    padding: '10px 16px',
    background: colors.primary,
    color: '#fff',
    fontWeight: 700,
    cursor: 'pointer',
  },
  secondary: {
    border: `1px solid ${colors.border}`,
    borderRadius: 10,
    padding: '9px 14px',
    background: colors.card,
    color: colors.text,
    fontWeight: 600,
    cursor: 'pointer',
  },
  danger: {
    border: `1px solid #fecaca`,
    borderRadius: 10,
    padding: '9px 14px',
    background: '#fff1f2',
    color: '#b91c1c',
    fontWeight: 700,
    cursor: 'pointer',
  },
  tableWrap: {
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    minWidth: 760,
  },
  th: {
    textAlign: 'left',
    padding: '12px 10px',
    borderBottom: `1px solid ${colors.border}`,
    color: colors.muted,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  td: {
    padding: '13px 10px',
    borderBottom: `1px solid ${colors.border}`,
    color: colors.text,
    fontSize: 14,
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    borderRadius: 999,
    padding: '4px 9px',
    fontSize: 12,
    fontWeight: 700,
  },
  error: {
    padding: 12,
    borderRadius: 10,
    background: '#fff1f2',
    color: '#b91c1c',
    border: '1px solid #fecaca',
  },
  notice: {
    padding: 12,
    borderRadius: 10,
    background: '#f0fdf4',
    color: '#166534',
    border: '1px solid #bbf7d0',
  },
  empty: {
    textAlign: 'center',
    padding: 32,
    color: colors.muted,
  },
};

function toOptionalDay(value: string): number | undefined {
  const trimmed = value.trim();

  if (!trimmed) {
    return undefined;
  }

  return Number(trimmed);
}

export default function FeeSettingsPage() {
  const [rules, setRules] = React.useState<FeeRule[]>([]);
  const [feeStructures, setFeeStructures] = React.useState<FeeStructure[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [editingId, setEditingId] = React.useState<number | null>(null);

  const [form, setForm] = React.useState({
    feeStructureId: '',
    lastDateDay: '',
    fineStartDay: '',
    fineAmount: '',
  });

  async function loadData() {
    setLoading(true);
    setError(null);

    try {
      const [rulesData, structuresRes] = await Promise.all([
        feeRulesApi.list(),
        api.get<FeeStructure[]>('/fees/structures'),
      ]);

      if (!structuresRes.success) {
        throw new Error('Unable to load fee structures.');
      }

      setRules(Array.isArray(rulesData) ? rulesData : []);
      setFeeStructures(
        Array.isArray(structuresRes.data)
          ? structuresRes.data.filter(
              (structure: FeeStructure) => structure.isActive
            )
          : []
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load fee settings.'
      );
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    void loadData();
  }, []);

  function resetForm() {
    setEditingId(null);
    setForm({
      feeStructureId: '',
      lastDateDay: '',
      fineStartDay: '',
      fineAmount: '',
    });
  }

  function startEdit(rule: FeeRule) {
    setEditingId(rule.id);
    setForm({
      feeStructureId: String(rule.feeStructureId),
      lastDateDay:
        rule.lastDateDay === null ? '' : String(rule.lastDateDay),
      fineStartDay:
        rule.fineStartDay === null ? '' : String(rule.fineStartDay),
      fineAmount: String(rule.fineAmount),
    });
    setError(null);
    setNotice(null);
  }

  async function saveRule(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);

    const feeStructureId = Number(form.feeStructureId);
    const lastDateDay = toOptionalDay(form.lastDateDay);
    const fineStartDay = toOptionalDay(form.fineStartDay);
    const fineAmount = form.fineAmount.trim()
      ? Number(form.fineAmount)
      : 0;

    if (!editingId && !feeStructureId) {
      setError('Please select a fee structure.');
      return;
    }

    if (
      lastDateDay !== undefined &&
      (!Number.isInteger(lastDateDay) ||
        lastDateDay < 1 ||
        lastDateDay > 31)
    ) {
      setError('Last Date must be between 1 and 31.');
      return;
    }

    if (
      fineStartDay !== undefined &&
      (!Number.isInteger(fineStartDay) ||
        fineStartDay < 1 ||
        fineStartDay > 31)
    ) {
      setError('Fine Start Date must be between 1 and 31.');
      return;
    }

    if (!Number.isInteger(fineAmount) || fineAmount < 0) {
      setError('Fine Amount must be a whole number of 0 or more.');
      return;
    }

    if (
      fineStartDay !== undefined &&
      lastDateDay !== undefined &&
      fineStartDay < lastDateDay
    ) {
      setError('Fine Start Date cannot be before Last Date.');
      return;
    }

    if (fineAmount > 0 && fineStartDay === undefined) {
      setError('Fine Start Date is required when a fine is configured.');
      return;
    }

    setSaving(true);

    try {
      if (editingId) {
        const payload: UpdateFeeRuleRequest = {
          lastDateDay: lastDateDay ?? null,
          fineStartDay: fineStartDay ?? null,
          fineAmount,
        };

        const updated = await feeRulesApi.update(editingId, payload);

        setRules((current) =>
          current.map((rule) =>
            rule.id === updated.id ? updated : rule
          )
        );

        setNotice('Fee rule updated successfully.');
      } else {
        const payload: CreateFeeRuleRequest = {
          feeStructureId,
          lastDateDay,
          fineStartDay,
          fineAmount,
        };

        const created = await feeRulesApi.create(payload);

        setRules((current) => [...current, created]);

        setNotice('Fee rule created successfully.');
      }

      resetForm();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to save fee rule.'
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteRule(rule: FeeRule) {
    const confirmed = window.confirm(
      `Delete fee rule for "${rule.feeName}" (${rule.className})?`
    );

    if (!confirmed) {
      return;
    }

    setError(null);
    setNotice(null);

    try {
      await feeRulesApi.remove(rule.id);
      setRules((current) =>
        current.filter((item) => item.id !== rule.id)
      );

      if (editingId === rule.id) {
        resetForm();
      }

      setNotice('Fee rule deleted. Existing student fee records are safe.');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to delete fee rule.'
      );
    }
  }

  async function toggleRule(rule: FeeRule) {
    setError(null);
    setNotice(null);

    try {
      const updated = await feeRulesApi.update(rule.id, {
        isActive: !rule.isActive,
      });

      setRules((current) =>
        current.map((item) =>
          item.id === updated.id ? updated : item
        )
      );

      setNotice(
        updated.isActive
          ? 'Fee rule activated.'
          : 'Fee rule deactivated.'
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to update fee rule status.'
      );
    }
  }

  const safeRules = Array.isArray(rules) ? rules : [];
  const safeFeeStructures = Array.isArray(feeStructures) ? feeStructures : [];

  const availableStructures = safeFeeStructures.filter(
    (structure) =>
      !safeRules.some(
        (rule) =>
          rule.feeStructureId === structure.id &&
          rule.id !== editingId
      )
  );

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Fee Settings</h1>
          <p style={styles.subtitle}>
            Set fee dates and late fines once. New student fees will use
            these rules automatically.
          </p>
        </div>
      </div>

      {error && <div style={styles.error}>{error}</div>}
      {notice && <div style={styles.notice}>{notice}</div>}

      <section style={styles.card}>
        <h2 style={{ margin: '0 0 6px', color: colors.text }}>
          {editingId ? 'Edit Fee Rule' : 'Add Fee Rule'}
        </h2>

        <p style={{ margin: '0 0 18px', ...styles.helper }}>
          Example: Last Date 10, Fine Start Date 13, Fine Rs. 500.
          The fine starts automatically from day 13 when money is still
          outstanding.
        </p>

        <form onSubmit={saveRule}>
          <div style={styles.grid}>
            <div style={styles.field}>
              <label style={styles.label}>Fee Structure</label>
              <select
                style={styles.input}
                value={form.feeStructureId}
                disabled={Boolean(editingId)}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    feeStructureId: event.target.value,
                  }))
                }
              >
                <option value="">Select fee structure</option>
                {(editingId ? feeStructures : availableStructures).map(
                  (structure) => (
                    <option key={structure.id} value={structure.id}>
                      {structure.className} ? {structure.feeName} ? Rs.{' '}
                      {structure.amount.toLocaleString('en-PK')}
                    </option>
                  )
                )}
              </select>
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Last Date</label>
              <input
                type="number"
                min="1"
                max="31"
                style={styles.input}
                value={form.lastDateDay}
                placeholder="Example: 10"
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    lastDateDay: event.target.value,
                  }))
                }
              />
              <span style={styles.helper}>
                Day of each month. Leave empty if not required.
              </span>
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Fine Start Date</label>
              <input
                type="number"
                min="1"
                max="31"
                style={styles.input}
                value={form.fineStartDay}
                placeholder="Example: 13"
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    fineStartDay: event.target.value,
                  }))
                }
              />
              <span style={styles.helper}>
                Fine applies from this day onward.
              </span>
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Fine Amount</label>
              <input
                type="number"
                min="0"
                step="1"
                style={styles.input}
                value={form.fineAmount}
                placeholder="Example: 500"
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    fineAmount: event.target.value,
                  }))
                }
              />
              <span style={styles.helper}>
                Fixed fine added only when the fee is still outstanding.
              </span>
            </div>
          </div>

          <div style={styles.actions}>
            <button type="submit" style={styles.primary} disabled={saving}>
              {saving
                ? 'Saving...'
                : editingId
                  ? 'Update Rule'
                  : 'Add Rule'}
            </button>

            {editingId && (
              <button
                type="button"
                style={styles.secondary}
                onClick={resetForm}
                disabled={saving}
              >
                Cancel Edit
              </button>
            )}
          </div>
        </form>
      </section>

      <section style={styles.card}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
            marginBottom: 14,
          }}
        >
          <div>
            <h2 style={{ margin: 0, color: colors.text }}>
              Current Fee Rules
            </h2>
            <p style={{ margin: '5px 0 0', ...styles.helper }}>
              These rules are reused when new monthly fees are created.
            </p>
          </div>

          <span
            style={{
              ...styles.badge,
              background: '#eff6ff',
              color: '#1d4ed8',
            }}
          >
            {rules.length} rule{rules.length === 1 ? '' : 's'}
          </span>
        </div>

        {loading ? (
          <div style={styles.empty}>Loading fee rules...</div>
        ) : rules.length === 0 ? (
          <div style={styles.empty}>
            No fee rules configured yet. Add one above.
          </div>
        ) : (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Class</th>
                  <th style={styles.th}>Fee</th>
                  <th style={styles.th}>Last Date</th>
                  <th style={styles.th}>Fine From</th>
                  <th style={styles.th}>Fine</th>
                  <th style={styles.th}>Status</th>
                  <th style={styles.th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rules.map((rule) => (
                  <tr key={rule.id}>
                    <td style={styles.td}>{rule.className}</td>
                    <td style={styles.td}>{rule.feeName}</td>
                    <td style={styles.td}>
                      {rule.lastDateDay
                        ? `Day ${rule.lastDateDay}`
                        : '?'}
                    </td>
                    <td style={styles.td}>
                      {rule.fineStartDay
                        ? `Day ${rule.fineStartDay}`
                        : '?'}
                    </td>
                    <td style={styles.td}>
                      Rs. {rule.fineAmount.toLocaleString('en-PK')}
                    </td>
                    <td style={styles.td}>
                      <span
                        style={{
                          ...styles.badge,
                          background: rule.isActive
                            ? '#f0fdf4'
                            : '#f1f5f9',
                          color: rule.isActive
                            ? '#166534'
                            : '#64748b',
                        }}
                      >
                        {rule.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={styles.td}>
                      <div
                        style={{
                          display: 'flex',
                          gap: 7,
                          flexWrap: 'wrap',
                        }}
                      >
                        <button
                          type="button"
                          style={styles.secondary}
                          onClick={() => startEdit(rule)}
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          style={styles.secondary}
                          onClick={() => void toggleRule(rule)}
                        >
                          {rule.isActive ? 'Disable' : 'Activate'}
                        </button>

                        <button
                          type="button"
                          style={styles.danger}
                          onClick={() => void deleteRule(rule)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
