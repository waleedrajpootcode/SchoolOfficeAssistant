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
    <div style={{ animation: 'soaMyClassesPageIn 240ms ease-out' }}>
      <style>{`
        @keyframes soaMyClassesPageIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <h1 style={s.pageTitle}>My Classes</h1>
      <p style={s.muted}>Classes assigned to you. Select one to mark attendance.</p>

      {error && <p style={s.errText} role="alert">{error}</p>}

      {loading ? (
        <p style={s.spinner}>Loading your classes…</p>
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
          <div style={{ fontSize: 28, marginBottom: 8 }}>?</div>
          <div style={{ fontWeight: 750, color: '#172B3A', marginBottom: 4 }}>
            No classes assigned
          </div>
          <div style={{ color: '#64748b' }}>
            An administrator needs to assign you a class before attendance can be marked.
          </div>
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
                position: 'relative',
                borderRadius: 16,
                border: `1px solid ${s.border}`,
                background: 'linear-gradient(135deg, #ffffff 0%, #f8fbff 100%)',
                boxShadow: '0 9px 24px rgba(18,59,93,0.07)',
                transition: 'transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease',
              }}
              onClick={() => navigate('attendance', { classId: c.id })}
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'translateY(-3px)';
                e.currentTarget.style.boxShadow = '0 14px 30px rgba(18,59,93,0.12)';
                e.currentTarget.style.borderColor = 'rgba(22,119,200,0.28)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = '';
                e.currentTarget.style.boxShadow = '0 9px 24px rgba(18,59,93,0.07)';
                e.currentTarget.style.borderColor = '#D9E2EC';
              }}
              onFocus={e => {
                e.currentTarget.style.borderColor = '#1677C8';
                e.currentTarget.style.boxShadow = '0 0 0 3px rgba(22,119,200,0.12), 0 10px 26px rgba(18,59,93,0.10)';
              }}
              onBlur={e => {
                e.currentTarget.style.borderColor = '#D9E2EC';
                e.currentTarget.style.boxShadow = '0 9px 24px rgba(18,59,93,0.07)';
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 13,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 14,
                  background: 'linear-gradient(135deg, #123B5D 0%, #1677C8 62%, #38BDF8 100%)',
                  color: '#fff',
                  fontWeight: 800,
                  boxShadow: '0 8px 18px rgba(22,119,200,0.20)',
                }}
              >
                {c.name.trim().charAt(0).toUpperCase() || 'C'}
              </div>
              <h3
                style={{
                  margin: '0 0 0.35rem',
                  fontSize: '1.08rem',
                  color: '#172B3A',
                  fontWeight: 750,
                  letterSpacing: -0.15,
                }}
              >
                {c.name}
              </h3>
              <p style={{ ...s.muted, marginBottom: 0 }}>
                {c.section ? `Section ${c.section}` : 'No section'}
              </p>
              <div
                style={{
                  marginTop: 14,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                }}
              >
                <span
                  style={{
                    ...s.badgeGreen,
                    ...s.badge,
                    borderRadius: 999,
                    padding: '5px 10px',
                    fontWeight: 750,
                    boxShadow: '0 3px 9px rgba(21,128,61,0.12)',
                  }}
                >
                  Active
                </span>
                <span
                  style={{
                    color: '#1677C8',
                    fontSize: 13,
                    fontWeight: 750,
                  }}
                >
                  Mark attendance ?
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}