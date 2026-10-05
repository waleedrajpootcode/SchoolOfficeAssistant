import React, { useEffect, useState } from 'react';
import type { ClassSummary } from '@school/shared';
import { classesApi } from '../api/classes.js';
import { s } from '../styles/shared.js';

interface Editing {
  id: number;
  name: string;
  section: string;
}

export function ClassesPage() {
  const [classes, setClasses] = useState<ClassSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // create form state
  const [name, setName] = useState('');
  const [section, setSection] = useState('');
  const [formErr, setFormErr] = useState<string | null>(null);

  const [editing, setEditing] = useState<Editing | null>(null);
  const [editBusy, setEditBusy] = useState(false);
  const [actionBusy, setActionBusy] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    const res = await classesApi.list();
    if (res.success && res.data) setClasses(res.data);
    else setError(res.error ?? 'Failed to load classes');
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function showNotice(msg: string) {
    setNotice(msg);
    window.setTimeout(() => setNotice(null), 4000);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) { setFormErr('Class name is required'); return; }
    setFormErr(null);
    setBusy(true);
    const res = await classesApi.create({ name: trimmed, section: section.trim() || undefined });
    setBusy(false);
    if (res.success) { setName(''); setSection(''); showNotice(`Class "${res.data?.name}" created`); load(); }
    else setFormErr(res.error ?? 'Failed to create class');
  }

  async function handleToggleActive(c: ClassSummary) {
    if (!window.confirm(`${c.isActive ? 'Deactivate' : 'Activate'} class "${c.name}"?`)) return;
    setActionBusy(c.id);
    setError(null);
    if (c.isActive) {
      const res = await classesApi.deactivate(c.id);
      if (res.success) showNotice(`Class "${c.name}" deactivated`);
      else setError(res.error ?? 'Failed to deactivate class');
    } else {
      const res = await classesApi.update(c.id, { isActive: true });
      if (res.success) showNotice(`Class "${c.name}" activated`);
      else setError(res.error ?? 'Failed to activate class');
    }
    setActionBusy(null);
    load();
  }

  function openEdit(c: ClassSummary) {
    setEditing({ id: c.id, name: c.name, section: c.section ?? '' });
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    if (!editing.name.trim()) { setFormErr('Class name is required'); return; }
    setFormErr(null);
    setEditBusy(true);
    const res = await classesApi.update(editing.id, {
      name: editing.name.trim(),
      section: editing.section.trim() === '' ? '' : editing.section.trim(),
    });
    setEditBusy(false);
    if (res.success) {
      setEditing(null);
      showNotice(`Class "${res.data?.name}" updated`);
      load();
    } else {
      setFormErr(res.error ?? 'Failed to update class');
    }
  }

  return (
    <div style={{ animation: 'soaClassesPageIn 240ms ease-out' }}>
      <style>{`
        @keyframes soaClassesPageIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .soa-class-input:focus {
          outline: none;
          border-color: #1677C8 !important;
          box-shadow: 0 0 0 3px rgba(22,119,200,0.12) !important;
        }
      `}</style>

      <h1 style={s.pageTitle}>Classes</h1>
      <p style={s.muted}>Create, edit and activate/deactivate classes.</p>

      {/* ── Create form ── */}
      <div
        style={{
          ...s.card,
          borderRadius: 16,
          background: 'linear-gradient(135deg, #ffffff 0%, #f8fbff 100%)',
          boxShadow: '0 10px 28px rgba(18,59,93,0.07)',
        }}
      >
        <h2 style={s.formTitle}>Add Class</h2>
        <form onSubmit={handleCreate} noValidate>
          <div style={s.row}>
            <div style={{ ...s.field, flex: '2 1 180px' }}>
              <label style={s.label} htmlFor="cname">Class name *</label>
              <input
                id="cname" style={s.input} className="soa-class-input" placeholder="e.g. Class 5"
                value={name} onChange={e => setName(e.target.value)} disabled={busy} required
              />
            </div>
            <div style={{ ...s.field, flex: '1 1 140px' }}>
              <label style={s.label} htmlFor="csection">Section (optional)</label>
              <input
                id="csection" style={s.input} className="soa-class-input" placeholder="A / B"
                value={section} onChange={e => setSection(e.target.value)} disabled={busy}
              />
            </div>
            <button
              type="submit"
              style={{
                ...s.btn,
                background: 'linear-gradient(135deg, #123B5D 0%, #1677C8 68%, #38BDF8 100%)',
                borderColor: 'rgba(18,59,93,0.18)',
                boxShadow: '0 8px 18px rgba(18,59,93,0.18)',
                transition: 'transform 160ms ease, box-shadow 160ms ease',
              }}
              disabled={busy || !name.trim()}
            >
              {busy ? 'Adding…' : 'Add Class'}
            </button>
          </div>
          {formErr && <p style={s.errText} role="alert">{formErr}</p>}
        </form>
      </div>

      {error && <p style={s.errText} role="alert">{error}</p>}
      {notice && <p style={s.okText}>{notice}</p>}

      {/* ── List ── */}
      {loading ? (
        <p style={s.spinner}>Loading classes…</p>
      ) : classes.length === 0 ? (
        <div
          style={{
            ...s.card,
            ...s.empty,
            marginTop: 14,
            borderRadius: 16,
            border: `1px dashed ${s.border}`,
            background: 'linear-gradient(135deg, #ffffff 0%, #f8fbff 100%)',
            boxShadow: '0 8px 22px rgba(18,59,93,0.055)',
          }}
        >
          <div style={{ fontSize: 28, marginBottom: 8 }}>+</div>
          <div style={{ fontWeight: 750, color: '#172B3A', marginBottom: 4 }}>
            No classes yet
          </div>
          <div style={{ color: '#64748b' }}>
            Use the form above to add your first class.
          </div>
        </div>
      ) : (
        <div
          style={{
            ...s.tableWrap,
            marginTop: 4,
            borderRadius: 16,
            border: `1px solid ${s.border}`,
            boxShadow: '0 10px 28px rgba(18,59,93,0.07)',
            background: '#ffffff',
            overflow: 'hidden',
          }}
        >
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>Name</th>
                <th style={s.th}>Section</th>
                <th style={s.th}>Status</th>
                <th style={s.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {classes.map(c => (
                <tr
                  key={c.id}
                  style={{
                    opacity: c.isActive ? 1 : 0.58,
                    transition: 'background 160ms ease',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background =
                      'linear-gradient(90deg, rgba(239,246,255,0.72), rgba(248,250,252,0.55))';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = '';
                  }}
                >
                  <td style={{ ...s.td, fontWeight: 650 }}>{c.name}</td>
                  <td style={s.td}>{c.section || '—'}</td>
                  <td style={s.td}>
                    <span
                      style={{
                        ...(c.isActive ? s.badgeGreen : s.badgeGrey),
                        borderRadius: 999,
                        padding: '5px 10px',
                        fontSize: 12,
                        fontWeight: 750,
                        letterSpacing: 0.15,
                        boxShadow: c.isActive
                          ? '0 3px 9px rgba(21,128,61,0.12)'
                          : '0 3px 9px rgba(100,116,139,0.10)',
                      }}
                    >
                      {c.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={s.td}>
                    <span
                      style={{
                        ...s.actions,
                        gap: 7,
                        flexWrap: 'wrap',
                      }}
                    >
                      <button
                        type="button"
                        style={{
                          ...s.btnSecondary,
                          ...s.btnSmall,
                          borderRadius: 9,
                          fontWeight: 700,
                          transition: 'transform 160ms ease, box-shadow 160ms ease',
                        }}
                        onClick={() => openEdit(c)}
                        onMouseEnter={e => {
                          e.currentTarget.style.transform = 'translateY(-1px)';
                          e.currentTarget.style.boxShadow = '0 5px 12px rgba(15,23,42,0.10)';
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.transform = '';
                          e.currentTarget.style.boxShadow = '';
                        }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        style={{
                          ...(c.isActive
                            ? { ...s.btnDanger, ...s.btnSmall }
                            : { ...s.btnSecondary, ...s.btnSmall }),
                          borderRadius: 9,
                          fontWeight: 700,
                          transition: 'transform 160ms ease, box-shadow 160ms ease',
                        }}
                        onClick={() => handleToggleActive(c)}
                        disabled={actionBusy === c.id}
                        onMouseEnter={e => {
                          if (!e.currentTarget.disabled) {
                            e.currentTarget.style.transform = 'translateY(-1px)';
                            e.currentTarget.style.boxShadow = c.isActive
                              ? '0 5px 12px rgba(220,38,38,0.16)'
                              : '0 5px 12px rgba(15,23,42,0.10)';
                          }
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.transform = '';
                          e.currentTarget.style.boxShadow = '';
                        }}
                      >
                        {actionBusy === c.id ? '…' : (c.isActive ? 'Deactivate' : 'Activate')}
                      </button>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Edit modal ── */}
      {editing && (
        <div style={s.modal} onClick={() => setEditing(null)}>
          <div
            style={{
              ...s.modalCard,
              maxWidth: 560,
              borderRadius: 18,
              border: `1px solid ${s.border}`,
              boxShadow: '0 24px 70px rgba(15,23,42,0.20)',
              background: 'linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <h2
              style={{
                ...s.modalTitle,
                marginBottom: 18,
                letterSpacing: -0.2,
              }}
            >
              Edit Class
            </h2>
            <form
              onSubmit={handleSaveEdit}
              noValidate
              style={{
                ...s.form,
                gap: 14,
              }}
            >
              <div style={s.field}>
                <label style={s.label} htmlFor="ename">Class name *</label>
                <input
                  id="ename"
                  style={s.input}
                  className="soa-class-input"
                  value={editing.name}
                  onChange={e => setEditing({ ...editing, name: e.target.value })}
                  required
                />
              </div>
              <div style={s.field}>
                <label style={s.label} htmlFor="esection">Section</label>
                <input
                  id="esection"
                  style={s.input}
                  className="soa-class-input"
                  value={editing.section}
                  onChange={e => setEditing({ ...editing, section: e.target.value })}
                />
              </div>
              {formErr && <p style={s.errText} role="alert">{formErr}</p>}
              <div
                style={{
                  ...s.modalActions,
                  marginTop: 4,
                  gap: 9,
                }}
              >
                <button
                  type="button"
                  style={{
                    ...s.btnSecondary,
                    borderRadius: 9,
                    fontWeight: 700,
                    transition: 'transform 160ms ease, box-shadow 160ms ease',
                  }}
                  onClick={() => setEditing(null)}
                  onMouseEnter={e => {
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 5px 12px rgba(15,23,42,0.10)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.transform = '';
                    e.currentTarget.style.boxShadow = '';
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    ...s.btn,
                    background: 'linear-gradient(135deg, #123B5D 0%, #1677C8 68%, #38BDF8 100%)',
                    borderColor: 'rgba(18,59,93,0.18)',
                    boxShadow: '0 8px 18px rgba(18,59,93,0.18)',
                    borderRadius: 9,
                    fontWeight: 700,
                    transition: 'transform 160ms ease, box-shadow 160ms ease',
                  }}
                  disabled={editBusy || !editing.name.trim()}
                  onMouseEnter={e => {
                    if (!e.currentTarget.disabled) {
                      e.currentTarget.style.transform = 'translateY(-1px)';
                      e.currentTarget.style.boxShadow = '0 10px 20px rgba(18,59,93,0.22)';
                    }
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.transform = '';
                    e.currentTarget.style.boxShadow = '';
                  }}
                >
                  {editBusy ? 'Saving…' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}