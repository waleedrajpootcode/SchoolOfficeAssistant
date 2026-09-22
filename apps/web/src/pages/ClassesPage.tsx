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
    <div>
      <h1 style={s.pageTitle}>Classes</h1>
      <p style={s.muted}>Create, edit and activate/deactivate classes.</p>

      {/* ── Create form ── */}
      <div style={s.card}>
        <h2 style={s.formTitle}>Add Class</h2>
        <form onSubmit={handleCreate} noValidate>
          <div style={s.row}>
            <div style={{ ...s.field, flex: '2 1 180px' }}>
              <label style={s.label} htmlFor="cname">Class name *</label>
              <input
                id="cname" style={s.input} placeholder="e.g. Class 5"
                value={name} onChange={e => setName(e.target.value)} disabled={busy} required
              />
            </div>
            <div style={{ ...s.field, flex: '1 1 140px' }}>
              <label style={s.label} htmlFor="csection">Section (optional)</label>
              <input
                id="csection" style={s.input} placeholder="A / B"
                value={section} onChange={e => setSection(e.target.value)} disabled={busy}
              />
            </div>
            <button type="submit" style={s.btn} disabled={busy || !name.trim()}>
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
        <div style={{ ...s.card, ...s.empty }}>
          No classes yet. Use the form above to add your first class.
        </div>
      ) : (
        <div style={s.tableWrap}>
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
                <tr key={c.id} style={{ opacity: c.isActive ? 1 : 0.55 }}>
                  <td style={s.td}>{c.name}</td>
                  <td style={s.td}>{c.section || '—'}</td>
                  <td style={s.td}>
                    <span style={c.isActive ? s.badgeGreen : s.badgeGrey}>
                      {c.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={s.td}>
                    <span style={s.actions}>
                      <button style={{ ...s.btnSecondary, ...s.btnSmall }} onClick={() => openEdit(c)}>Edit</button>
                      <button
                        style={c.isActive ? {...s.btnDanger, ...s.btnSmall} : {...s.btnSecondary, ...s.btnSmall}}
                        onClick={() => handleToggleActive(c)}
                        disabled={actionBusy === c.id}
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
          <div style={s.modalCard} onClick={e => e.stopPropagation()}>
            <h2 style={s.modalTitle}>Edit Class</h2>
            <form onSubmit={handleSaveEdit} noValidate style={s.form}>
              <div style={s.field}>
                <label style={s.label} htmlFor="ename">Class name *</label>
                <input id="ename" style={s.input} value={editing.name}
                  onChange={e => setEditing({ ...editing, name: e.target.value })} required />
              </div>
              <div style={s.field}>
                <label style={s.label} htmlFor="esection">Section</label>
                <input id="esection" style={s.input} value={editing.section}
                  onChange={e => setEditing({ ...editing, section: e.target.value })} />
              </div>
              {formErr && <p style={s.errText} role="alert">{formErr}</p>}
              <div style={s.modalActions}>
                <button type="button" style={s.btnSecondary} onClick={() => setEditing(null)}>Cancel</button>
                <button type="submit" style={s.btn} disabled={editBusy || !editing.name.trim()}>
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