import React, { useState } from 'react';
import type { CSSProperties } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { navigate, useRoute, type RouteName } from '../router.js';
import { colors } from '../styles/shared.js';

interface NavItem {
  route: RouteName;
  label: string;
}

const ADMIN_NAV: NavItem[] = [
  { route: 'dashboard', label: 'Dashboard' },
  { route: 'classes', label: 'Classes' },
  { route: 'students', label: 'Students' },
  { route: 'assignments', label: 'Teacher Assignments' },
  { route: 'attendance', label: 'Attendance' },
  { route: 'fees', label: 'Fees' },
];

const TEACHER_NAV: NavItem[] = [
  { route: 'dashboard', label: 'Dashboard' },
  { route: 'my-classes', label: 'My Classes' },
  { route: 'attendance', label: 'Attendance' },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const { route } = useRoute();
  const [busy, setBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const nav = user?.role === 'admin' ? ADMIN_NAV : TEACHER_NAV;

  async function handleLogout() {
    setBusy(true);
    await logout();
  }

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div style={styles.brandRow}>
          <span style={styles.appName}>School Office Assistant</span>
          <span style={styles.role}>{user?.role}</span>
        </div>

        <nav style={styles.nav} id="topnav">
          {nav.map(item => (
            <button
              key={item.route}
              type="button"
              style={{
                ...styles.navLink,
                ...(route === item.route ? styles.navLinkActive : {}),
              }}
              onClick={() => { setMenuOpen(false); navigate(item.route); }}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div style={styles.userInfo}>
          <span style={styles.displayName} title={user?.username}>{user?.displayName}</span>
          <button type="button" onClick={handleLogout} disabled={busy} style={styles.logoutBtn}>
            {busy ? 'Signing out…' : 'Sign out'}
          </button>
          <button
            type="button"
            style={styles.hamburger}
            onClick={() => setMenuOpen(o => !o)}
            aria-label="Toggle navigation"
            aria-expanded={menuOpen}
          >
            ☰
          </button>
        </div>
      </header>

      {menuOpen && (
        <nav style={styles.mobileNav}>
          {nav.map(item => (
            <button
              key={`m-${item.route}`}
              type="button"
              style={{
                ...styles.mobileLink,
                ...(route === item.route ? styles.mobileLinkActive : {}),
              }}
              onClick={() => { setMenuOpen(false); navigate(item.route); }}
            >
              {item.label}
            </button>
          ))}
        </nav>
      )}

      <main style={styles.main}>{children}</main>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: colors.background,
  },
  header: {
    background: colors.primary,
    color: '#fff',
    padding: '0.7rem 1.25rem',
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    flexWrap: 'wrap',
    position: 'sticky',
    top: 0,
    zIndex: 50,
  },
  brandRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.6rem',
    marginRight: 'auto',
  },
  appName: {
    fontWeight: 700,
    fontSize: '1rem',
    letterSpacing: '0.02em',
  },
  role: {
    background: 'rgba(255,255,255,0.14)',
    borderRadius: 4,
    padding: '0.15rem 0.5rem',
    fontSize: '0.72rem',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  nav: {
    display: 'flex',
    gap: '0.35rem',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  navLink: {
    background: 'transparent',
    color: '#dfe3ee',
    border: 'none',
    borderRadius: 5,
    padding: '0.35rem 0.7rem',
    fontSize: '0.88rem',
    fontWeight: 500,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  navLinkActive: {
    background: '#ffffff22',
    color: '#fff',
  },
  userInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.6rem',
  },
  displayName: {
    fontSize: '0.88rem',
    maxWidth: 160,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  logoutBtn: {
    background: 'transparent',
    border: '1px solid #ffffff66',
    color: '#fff',
    borderRadius: 4,
    padding: '0.28rem 0.7rem',
    cursor: 'pointer',
    fontSize: '0.84rem',
  },
  hamburger: {
    display: 'none',
    background: 'transparent',
    border: '1px solid #ffffff66',
    color: '#fff',
    borderRadius: 4,
    padding: '0.2rem 0.6rem',
    cursor: 'pointer',
    fontSize: '1.05rem',
    lineHeight: 1,
  },
  mobileNav: {
    background: colors.primarySoft,
    padding: '0.5rem 1rem 0.75rem',
    display: 'none',
    flexDirection: 'column',
    gap: '0.3rem',
  },
  mobileLink: {
    textAlign: 'left',
    background: 'transparent',
    color: '#dfe3ee',
    border: 'none',
    borderRadius: 5,
    padding: '0.6rem 0.7rem',
    fontSize: '0.95rem',
    cursor: 'pointer',
  },
  mobileLinkActive: {
    background: '#ffffff22',
    color: '#fff',
  },
  main: {
    padding: '1.5rem',
    maxWidth: 1100,
    margin: '0 auto',
    width: '100%',
  },
};