import React, { useEffect, useState } from 'react';
import type { ClassSummary } from '@school/shared';
import { classesApi } from '../api/classes.js';
import { navigate } from '../router.js';
import { s } from '../styles/shared.js';

export function MyClassesPage() {
  const [classes, setClasses] = useState<ClassSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    classesApi.listMine().then((res) => {
      if (res.success && res.data) setClasses(res.data);
      else setError(res.error ?? 'Failed to load your classes');
      setLoading(false);
    });
  }, []);

  return (
    <div>
      <h1 style={s.pageTitle}>My Classes</h1>
      <p style={s.muted}>Classes assigned to you. Select one to mark attendance.</p>

      {error && <p style={s.errText} role="alert">{error}</p>}

      {loading ? (
        <p style={s.spinner}>Loading your classes…</p>
      ) : classes.length === 0 ? (
        <div style={{ ...s.card, ...s.empty }}>
          No classes assigned to you yet. An administrator needs to assign you a class.
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))',
            gap: '0.85rem',
            width: '100%',
            maxWidth: '100%',
            minWidth: 0,
          }}
        >
          {classes.map(c => (
            <button
              key={c.id}
              type="button"
              style={{
                ...s.card,
                textAlign: 'left',
                cursor: 'pointer',
                width: '100%',
                maxWidth: '100%',
                minWidth: 0,
                boxSizing: 'border-box',
                marginBottom: 0,
                overflow: 'hidden',
              }}
              onClick={() => navigate('attendance', { classId: c.id })}
            >
              <h3 style={{ margin: '0 0 0.35rem', fontSize: '1.05rem', color: '#1a1a1a' }}>{c.name}</h3>
              <p style={s.muted}>{c.section ? `Section ${c.section}` : 'No section'}</p>
              <p style={{ margin: '0.6rem 0 0', ...s.badgeGreen, ...s.badge }}>Active</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}