import React from 'react';
import type { CSSProperties } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { navigate, type RouteName } from '../router.js';
import { colors, s } from '../styles/shared.js';

interface Card {
  route: RouteName;
  title: string;
  desc: string;
}

export function Dashboard() {
  const { user } = useAuth();
  const cards: Card[] =
    user?.role === 'admin'
      ? [
          { route: 'classes', title: 'Classes', desc: 'Manage classes and sections' },
          { route: 'students', title: 'Students', desc: 'Add and manage students' },
          { route: 'assignments', title: 'Teacher Assignments', desc: 'Assign teachers to classes' },
          { route: 'attendance', title: 'Attendance', desc: 'View and record attendance' },
        ]
      : [
          { route: 'my-classes', title: 'My Classes', desc: 'Your assigned classes' },
          { route: 'attendance', title: 'Attendance', desc: 'Mark attendance for your classes' },
        ];

  return (
    <div>
      <h1 style={s.pageTitle}>Welcome, {user?.displayName}</h1>
      <p style={s.muted}>
        Signed in as <strong>{user?.username}</strong> ({user?.role}).
      </p>

      <div style={styles.grid}>
        {cards.map((c) => (
          <button key={c.route} type="button" style={styles.card} onClick={() => navigate(c.route)}>
            <h3 style={styles.cardTitle}>{c.title}</h3>
            <p style={styles.cardDesc}>{c.desc}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
    gap: '1rem',
    marginTop: '1.25rem',
  },
  card: {
    background: colors.card,
    borderRadius: 8,
    border: `1px solid ${colors.border}`,
    padding: '1.25rem',
    textAlign: 'left',
    cursor: 'pointer',
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
    transition: 'box-shadow 120ms ease, transform 120ms ease',
  },
  cardTitle: {
    margin: '0 0 0.4rem',
    fontSize: '1.05rem',
    fontWeight: 700,
    color: colors.text,
  },
  cardDesc: {
    margin: 0,
    fontSize: '0.88rem',
    color: colors.muted,
  },
};