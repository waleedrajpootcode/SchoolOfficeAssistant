import React, { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { navigate, useRoute, type RouteName } from '../router.js';
import { api } from '../api/client.js';
import { colors } from '../styles/shared.js';

interface NavItem {
  route: RouteName;
  label: string;
}

const ADMIN_NAV: NavItem[] = [
  { route: 'dashboard', label: 'Dashboard' },
  { route: 'classes', label: 'Classes' },
  { route: 'students', label: 'Students' },
  { route: 'teachers', label: 'Teachers' },
  { route: 'assignments', label: 'Assignments' },
  { route: 'attendance', label: 'Attendance' },
  { route: 'fees', label: 'Fees' },
  { route: 'settings', label: 'Settings' },
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
  const [schoolName, setSchoolName] = useState('School Office Assistant');

  useEffect(() => {
    let cancelled = false;

    async function loadSchoolName() {
      const result = await api.get<{ schoolName: string }>('/settings');

      if (!cancelled && result.success && result.data?.schoolName?.trim()) {
        setSchoolName(result.data.schoolName.trim());
      }
    }

    void loadSchoolName();

    return () => {
      cancelled = true;
    };
  }, []);

  const nav = user?.role === 'admin' ? ADMIN_NAV : TEACHER_NAV;

  async function handleLogout() {
    setBusy(true);
    await logout();
  }

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div
          className="header-inner"
          style={styles.headerInner}
        >
          <div
            className="brand-row"
            style={styles.brandRow}
          >
            <div
              className="brand-mark"
              style={styles.brandMark}
              aria-hidden="true"
            >
              SO
            </div>

            <div
              className="brand-text"
              style={styles.brandText}
            >
              <span
                className="app-name"
                style={styles.appName}
              >
                {schoolName}
              </span>

              <span
                className="product-name"
                style={styles.productName}
              >
                School Office Assistant
              </span>
            </div>

            <span
              className="role"
              style={styles.role}
            >
              {user?.role}
            </span>
          </div>

          <nav
            id="topnav"
            style={styles.nav}
            aria-label="Main navigation"
          >
            {nav.map(item => (
              <button
                key={item.route}
                type="button"
                style={{
                  ...styles.navLink,
                  ...(route === item.route
                    ? styles.navLinkActive
                    : {}),
                }}
                onClick={() => {
                  setMenuOpen(false);
                  navigate(item.route);
                }}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div
            className="user-info"
            style={styles.userInfo}
          >
            <div
              className="user-block"
              style={styles.userBlock}
            >
              <span
                style={styles.displayName}
                title={user?.username}
              >
                {user?.displayName}
              </span>

              <span style={styles.username}>
                {user?.username}
              </span>
            </div>

            <button
              type="button"
              className="logout-button"
              onClick={handleLogout}
              disabled={busy}
              style={styles.logoutBtn}
            >
              {busy ? 'Signing out…' : 'Sign out'}
            </button>

            <button
              type="button"
              className="mobile-menu-button"
              style={styles.hamburger}
              onClick={() => setMenuOpen(open => !open)}
              aria-label="Toggle navigation"
              aria-expanded={menuOpen}
            >
              <span className="hamburger-line" />
              <span className="hamburger-line" />
              <span className="hamburger-line" />
            </button>
          </div>
        </div>
      </header>

      {menuOpen && (
        <nav
          className="mobile-nav"
          style={styles.mobileNav}
          aria-label="Mobile navigation"
        >
          {nav.map(item => (
            <button
              key={`mobile-${item.route}`}
              type="button"
              style={{
                ...styles.mobileLink,
                ...(route === item.route
                  ? styles.mobileLinkActive
                  : {}),
              }}
              onClick={() => {
                setMenuOpen(false);
                navigate(item.route);
              }}
            >
              {item.label}
            </button>
          ))}
        </nav>
      )}

      <main style={styles.main}>
        {children}
      </main>

      <style>{`
        #topnav button:hover {
          background: rgba(255, 255, 255, 0.08);
          color: #fff;
        }

        #topnav button:active {
          transform: translateY(1px);
        }

        .logout-button:hover {
          background: rgba(255, 255, 255, 0.14) !important;
          border-color: rgba(255, 255, 255, 0.3) !important;
        }

        .mobile-menu-button:hover {
          background: rgba(255, 255, 255, 0.08) !important;
        }

        .hamburger-line {
          display: block;
          width: 16px;
          height: 2px;
          flex: 0 0 2px;
          border-radius: 2px;
          background: #fff;
        }

        @media (max-width: 1100px) {
          .user-block {
            display: none !important;
          }
        }

        @media (max-width: 860px) {
          #topnav {
            display: none !important;
          }

          .header-inner {
            width: 100% !important;
            max-width: 100% !important;
            min-width: 0 !important;
            box-sizing: border-box !important;
            min-height: 62px !important;
            padding: 0.65rem 1rem !important;
            gap: 0.65rem !important;
            flex-wrap: nowrap !important;
            overflow: hidden !important;
          }

          .brand-row {
            flex: 1 1 auto !important;
            min-width: 0 !important;
            max-width: none !important;
            margin-right: 0 !important;
            overflow: hidden !important;
          }

          .brand-text {
            min-width: 0 !important;
            max-width: 100% !important;
            overflow: hidden !important;
          }

          .app-name {
            display: block !important;
            max-width: 100% !important;
            overflow: hidden !important;
            text-overflow: ellipsis !important;
            white-space: nowrap !important;
          }

          .product-name {
            display: block !important;
            max-width: 100% !important;
            overflow: hidden !important;
            text-overflow: ellipsis !important;
            white-space: nowrap !important;
          }

          .role {
            flex: 0 0 auto !important;
          }

          .user-info {
            flex: 0 0 auto !important;
            min-width: 38px !important;
            margin-left: auto !important;
            gap: 0 !important;
          }

          .logout-button {
            display: none !important;
          }

          .mobile-menu-button {
            display: inline-flex !important;
            flex: 0 0 38px !important;
            width: 38px !important;
            height: 38px !important;
            align-items: center !important;
            justify-content: center !important;
          }

          .mobile-nav {
            display: flex !important;
            width: 100% !important;
            max-width: 100% !important;
            box-sizing: border-box !important;
            overflow: hidden !important;
          }

          .mobile-nav button {
            width: 100% !important;
            max-width: 100% !important;
            box-sizing: border-box !important;
          }

          main {
            width: 100% !important;
            max-width: 100% !important;
            min-width: 0 !important;
            box-sizing: border-box !important;
            padding: 1rem !important;
            margin: 0 !important;
            overflow-x: hidden !important;
          }
        }

        @media (max-width: 560px) {
          .header-inner {
            min-height: 58px !important;
            padding: 0.55rem 0.75rem !important;
            gap: 0.5rem !important;
          }

          .brand-mark {
            width: 34px !important;
            height: 34px !important;
            flex: 0 0 34px !important;
            border-radius: 8px !important;
            font-size: 0.7rem !important;
          }

          .brand-row {
            gap: 0.5rem !important;
          }

          .brand-text {
            max-width: calc(100vw - 105px) !important;
          }

          .product-name {
            display: none !important;
          }

          .role {
            display: none !important;
          }

          .mobile-menu-button {
            width: 36px !important;
            height: 36px !important;
            flex: 0 0 36px !important;
          }

          main {
            padding: 0.85rem !important;
          }
        }

        @media (max-width: 380px) {
          .header-inner {
            padding-left: 0.6rem !important;
            padding-right: 0.6rem !important;
          }

          .brand-text {
            max-width: calc(100vw - 88px) !important;
          }

          main {
            padding-left: 0.65rem !important;
            padding-right: 0.65rem !important;
          }
        }
      `}</style>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: '100vh',
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    overflowX: 'hidden',
    overscrollBehaviorX: 'none',
    background: colors.background,
  },

  header: {
    width: '100%',
    maxWidth: '100%',
    background:
      'linear-gradient(135deg, #172554 0%, #1e3a8a 100%)',
    color: '#fff',
    position: 'sticky',
    top: 0,
    zIndex: 50,
    borderBottom: '1px solid rgba(255,255,255,0.1)',
    boxShadow: '0 4px 18px rgba(15,23,42,0.12)',
  },

  headerInner: {
    minHeight: 68,
    maxWidth: 1400,
    width: '100%',
    margin: '0 auto',
    padding: '0.65rem 1.25rem',
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    flexWrap: 'wrap',
    boxSizing: 'border-box',
  },

  brandRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.65rem',
    marginRight: 'auto',
    minWidth: 0,
  },

  brandMark: {
    width: 38,
    height: 38,
    flex: '0 0 38px',
    borderRadius: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(255,255,255,0.14)',
    border: '1px solid rgba(255,255,255,0.18)',
    color: '#fff',
    fontSize: '0.78rem',
    fontWeight: 800,
    letterSpacing: '0.04em',
  },

  brandText: {
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
    maxWidth: 250,
  },

  appName: {
    fontWeight: 750,
    fontSize: '0.92rem',
    letterSpacing: '-0.01em',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },

  productName: {
    marginTop: 1,
    color: 'rgba(255,255,255,0.62)',
    fontSize: '0.67rem',
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },

  role: {
    background: 'rgba(255,255,255,0.12)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 999,
    padding: '0.22rem 0.55rem',
    fontSize: '0.66rem',
    fontWeight: 750,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    whiteSpace: 'nowrap',
  },

  nav: {
    display: 'flex',
    gap: '0.2rem',
    flexWrap: 'wrap',
    alignItems: 'center',
  },

  navLink: {
    background: 'transparent',
    color: 'rgba(255,255,255,0.72)',
    border: '1px solid transparent',
    borderRadius: 8,
    padding: '0.46rem 0.68rem',
    fontSize: '0.8rem',
    fontWeight: 650,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    transition:
      'background 120ms ease, color 120ms ease, transform 120ms ease',
  },

  navLinkActive: {
    background: 'rgba(255,255,255,0.14)',
    color: '#fff',
    borderColor: 'rgba(255,255,255,0.08)',
  },

  userInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.65rem',
    minWidth: 0,
  },

  userBlock: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    minWidth: 0,
  },

  displayName: {
    fontSize: '0.78rem',
    fontWeight: 700,
    maxWidth: 150,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },

  username: {
    color: 'rgba(255,255,255,0.52)',
    fontSize: '0.65rem',
    maxWidth: 150,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },

  logoutBtn: {
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.2)',
    color: '#fff',
    borderRadius: 8,
    padding: '0.42rem 0.7rem',
    cursor: 'pointer',
    fontSize: '0.76rem',
    fontWeight: 650,
    whiteSpace: 'nowrap',
    transition:
      'background 120ms ease, border-color 120ms ease',
  },

  hamburger: {
    display: 'none',
    width: 38,
    height: 38,
    flexDirection: 'column',
    gap: 4,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.2)',
    color: '#fff',
    borderRadius: 8,
    padding: '0.45rem',
    cursor: 'pointer',
  },

  mobileNav: {
    background: '#172554',
    padding: '0.55rem 1rem 0.8rem',
    display: 'none',
    flexDirection: 'column',
    gap: '0.3rem',
    borderBottom: '1px solid rgba(255,255,255,0.1)',
    boxShadow: '0 6px 14px rgba(15,23,42,0.1)',
    boxSizing: 'border-box',
  },

  mobileLink: {
    width: '100%',
    textAlign: 'left',
    background: 'transparent',
    color: 'rgba(255,255,255,0.72)',
    border: '1px solid transparent',
    borderRadius: 8,
    padding: '0.62rem 0.75rem',
    fontSize: '0.9rem',
    fontWeight: 600,
    cursor: 'pointer',
    boxSizing: 'border-box',
  },

  mobileLinkActive: {
    background: 'rgba(255,255,255,0.12)',
    color: '#fff',
  },

  main: {
    padding: '1.75rem 1.5rem 2.5rem',
    maxWidth: 1180,
    margin: '0 auto',
    width: '100%',
    minWidth: 0,
    boxSizing: 'border-box',
    overflowX: 'hidden',
  },
};

