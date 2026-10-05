import React from 'react';
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
  { route: 'families', label: 'Families' },
  { route: 'teachers', label: 'Teachers' },
  { route: 'assignments', label: 'Assignments' },
  { route: 'attendance', label: 'Attendance' },
  { route: 'fees', label: 'Fees' },
  { route: 'salaries', label: 'Salaries' },
  { route: 'fee-settings', label: 'Fee Settings' },
  { route: 'settings', label: 'Settings' },
];

const TEACHER_NAV: NavItem[] = [
  { route: 'dashboard', label: 'Dashboard' },
  { route: 'my-classes', label: 'My Classes' },
  { route: 'attendance', label: 'Attendance' },
];

const SIDEBAR_WIDTH = 268;

const styles: Record<string, React.CSSProperties> = {
  shell: {
    minHeight: '100vh',
    background: colors.background,
    color: colors.text,
  },
  sidebar: {
    position: 'fixed',
    left: 0,
    top: 0,
    bottom: 0,
    width: SIDEBAR_WIDTH,
    boxSizing: 'border-box',
    background:
      'linear-gradient(180deg, #f8fbff 0%, #eef6ff 48%, #ffffff 100%)',
    borderRight: `1px solid ${colors.border}`,
    display: 'flex',
    flexDirection: 'column',
    zIndex: 100,
    overflowY: 'auto',
    boxShadow: '10px 0 34px rgba(18, 59, 93, 0.08)',
  },
  brand: {
    padding: '22px 18px 18px',
    borderBottom: `1px solid ${colors.border}`,
    background:
      'linear-gradient(135deg, rgba(18, 59, 93, 0.075) 0%, rgba(22, 119, 200, 0.085) 58%, rgba(99, 102, 241, 0.055) 100%)',
  },
  logo: {
    width: 44,
    height: 44,
    borderRadius: 13,
    background:
      'linear-gradient(135deg, #123B5D 0%, #1677C8 58%, #38BDF8 100%)',
    color: '#fff',
    display: 'grid',
    placeItems: 'center',
    fontWeight: 900,
    fontSize: 15,
    letterSpacing: 0.5,
    marginBottom: 12,
    boxShadow: '0 10px 22px rgba(22, 119, 200, 0.25)',
  },
  schoolName: {
    fontSize: 16,
    fontWeight: 800,
    color: colors.text,
    lineHeight: 1.25,
  },
  productName: {
    marginTop: 4,
    fontSize: 12,
    color: colors.muted,
    lineHeight: 1.4,
  },
  nav: {
    padding: '16px 12px',
    display: 'grid',
    gap: 5,
    flex: 1,
  },
  navButton: {
    width: '100%',
    border: '1px solid transparent',
    borderRadius: 11,
    padding: '10px 12px',
    background: 'rgba(255, 255, 255, 0.48)',
    color: colors.muted,
    textAlign: 'left',
    fontSize: 14,
    fontWeight: 650,
    cursor: 'pointer',
    transition:
      'background 160ms ease, color 160ms ease, border-color 160ms ease, transform 160ms ease, box-shadow 160ms ease',
  },
  navButtonActive: {
    background:
      'linear-gradient(135deg, #123B5D 0%, #1677C8 62%, #38BDF8 100%)',
    borderColor: 'rgba(18, 59, 93, 0.18)',
    color: '#fff',
    boxShadow: '0 9px 20px rgba(18, 59, 93, 0.22), 0 0 0 1px rgba(56, 189, 248, 0.08)',
    transform: 'translateX(2px)',
  },
  userArea: {
    padding: '15px 12px 16px',
    borderTop: `1px solid ${colors.border}`,
    background:
      'linear-gradient(135deg, rgba(239, 246, 255, 0.92) 0%, rgba(240, 253, 250, 0.82) 100%)',
  },
  role: {
    fontSize: 12,
    fontWeight: 700,
    color: colors.muted,
  },
  username: {
    marginTop: 3,
    fontSize: 14,
    fontWeight: 800,
    color: colors.text,
  },
  signOut: {
    width: '100%',
    marginTop: 12,
    border: `1px solid ${colors.border}`,
    borderRadius: 10,
    padding: '10px 12px',
    background: 'linear-gradient(135deg, #ffffff 0%, #f8fbff 100%)',
    color: colors.text,
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
    textAlign: 'left',
    boxShadow: '0 4px 12px rgba(15, 23, 42, 0.055)',
    transition:
      'background 160ms ease, border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease',
  },
  main: {
    minHeight: '100vh',
    marginLeft: SIDEBAR_WIDTH,
    boxSizing: 'border-box',
  },
  mobileTop: {
    display: 'none',
  },
  mobileOverlay: {
    display: 'none',
  },
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const { route } = useRoute();

  const [schoolName, setSchoolName] = React.useState('TEST SCHOOL');
  const [mobileOpen, setMobileOpen] = React.useState(false);

  const nav = user?.role === 'admin' ? ADMIN_NAV : TEACHER_NAV;

  React.useEffect(() => {
    let active = true;

    async function loadSchoolName() {
      try {
        const result = await api.get<{ schoolName: string }>('/settings');

        if (
          active &&
          result.success &&
          result.data?.schoolName?.trim()
        ) {
          setSchoolName(result.data.schoolName.trim());
        }
      } catch {
        // Keep the safe fallback school name.
      }
    }

    void loadSchoolName();

    return () => {
      active = false;
    };
  }, []);

  React.useEffect(() => {
    setMobileOpen(false);
  }, [route]);

  function handleNavigate(nextRoute: RouteName) {
    navigate(nextRoute);
    setMobileOpen(false);
  }

  function handleSignOut() {
    setMobileOpen(false);
    void logout();
  }

  return (
    <div style={styles.shell}>
      <style>
        {`
          @media (max-width: 900px) {
            .soa-sidebar {
              transform: translateX(-100%);
              transition: transform 180ms ease;
              box-shadow: none;
            }

            .soa-sidebar.soa-sidebar-open {
              transform: translateX(0);
              box-shadow: 12px 0 32px rgba(15, 23, 42, 0.16);
            }

            .soa-main {
              margin-left: 0 !important;
              padding-top: 64px;
            }

            .soa-mobile-top {
              display: flex !important;
              position: fixed;
              top: 0;
              left: 0;
              right: 0;
              height: 64px;
              background: linear-gradient(135deg, #ffffff 0%, #eff6ff 100%);
              border-bottom: 1px solid ${colors.border};
              box-shadow: 0 5px 18px rgba(18, 59, 93, 0.08);
              align-items: center;
              gap: 12px;
              padding: 0 14px;
              z-index: 90;
            }

            .soa-menu-button {
              width: 40px;
              height: 40px;
              border: 1px solid ${colors.border};
              border-radius: 10px;
              background: linear-gradient(135deg, #ffffff 0%, #eef6ff 100%);
              color: ${colors.primary};
              font-size: 20px;
              box-shadow: 0 4px 12px rgba(18, 59, 93, 0.08);
              transition: transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease;
              cursor: pointer;
            }

            .soa-mobile-title {
              min-width: 0;
            }

            .soa-mobile-school {
              font-size: 14px;
              font-weight: 800;
              color: ${colors.text};
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }

            .soa-mobile-product {
              font-size: 11px;
              color: ${colors.muted};
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }

            .soa-overlay {
              display: block !important;
              position: fixed;
              inset: 0;
              background: rgba(15, 23, 42, 0.35);
              z-index: 95;
            }
          }
        `}
      </style>

      <aside
        className={`soa-sidebar${mobileOpen ? ' soa-sidebar-open' : ''}`}
        style={styles.sidebar}
      >
        <div style={styles.brand}>
          <div style={styles.logo}>SO</div>
          <div style={styles.schoolName}>{schoolName}</div>
          <div style={styles.productName}>
            School Office Assistant
          </div>
        </div>

        <nav style={styles.nav} aria-label="Main navigation">
          {nav.map((item) => {
            const active = route === item.route;

            return (
              <button
                key={item.route}
                type="button"
                style={{
                  ...styles.navButton,
                  ...(active ? styles.navButtonActive : {}),
                }}
                onClick={() => handleNavigate(item.route)}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        <div style={styles.userArea}>
          <div style={styles.role}>
            {user?.role === 'admin' ? 'Administrator' : 'Teacher'}
          </div>

          <div style={styles.username}>
            {user?.displayName || user?.username || 'User'}
          </div>

          <button
            type="button"
            style={styles.signOut}
            onClick={handleSignOut}
          >
            Sign out
          </button>
        </div>
      </aside>

      <div
        className="soa-mobile-top"
        style={styles.mobileTop}
      >
        <button
          type="button"
          className="soa-menu-button"
          aria-label="Open navigation"
          onClick={() => setMobileOpen(true)}
        >
          ?
        </button>

        <div className="soa-mobile-title">
          <div className="soa-mobile-school">{schoolName}</div>
          <div className="soa-mobile-product">
            School Office Assistant
          </div>
        </div>
      </div>

      {mobileOpen && (
        <button
          type="button"
          className="soa-overlay"
          style={styles.mobileOverlay}
          aria-label="Close navigation"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <main className="soa-main" style={styles.main}>
        {children}
      </main>
    </div>
  );
}
