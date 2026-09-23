import React from 'react';
import type { CSSProperties } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { navigate, type RouteName } from '../router.js';
import { colors } from '../styles/shared.js';

interface Card {
  route: RouteName;
  title: string;
  desc: string;
  shortLabel: string;
}

export function Dashboard() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const cards: Card[] = isAdmin
    ? [
        {
          route: 'classes',
          title: 'Classes',
          desc: 'Manage classes, sections and classroom structure.',
          shortLabel: 'CL',
        },
        {
          route: 'students',
          title: 'Students',
          desc: 'Add, update and manage student records.',
          shortLabel: 'ST',
        },
        {
          route: 'assignments',
          title: 'Teacher Assignments',
          desc: 'Assign teachers to their classes and subjects.',
          shortLabel: 'TA',
        },
        {
          route: 'attendance',
          title: 'Attendance',
          desc: 'View and record daily student attendance.',
          shortLabel: 'AT',
        },
      ]
    : [
        {
          route: 'my-classes',
          title: 'My Classes',
          desc: 'View the classes assigned to you.',
          shortLabel: 'MC',
        },
        {
          route: 'attendance',
          title: 'Attendance',
          desc: 'Mark and manage attendance for your classes.',
          shortLabel: 'AT',
        },
      ];

  return (
    <div className="dashboard-page">
      <section className="dashboard-hero" style={styles.hero}>
        <div style={styles.heroContent}>
          <div style={styles.heroText}>
            <span style={styles.eyebrow}>
              {isAdmin ? 'ADMIN DASHBOARD' : 'TEACHER DASHBOARD'}
            </span>

            <h1 style={styles.title}>
              Welcome, {user?.displayName}
            </h1>

            <p style={styles.subtitle}>
              {isAdmin
                ? 'Manage your school operations from one place.'
                : 'Manage your classes and attendance from one place.'}
            </p>
          </div>

          <div className="dashboard-user-badge" style={styles.userBadge}>
            <span style={styles.userBadgeLabel}>Signed in as</span>
            <strong style={styles.userBadgeName}>
              {user?.username}
            </strong>
          </div>
        </div>
      </section>

      <section style={styles.section}>
        <div style={styles.sectionHeader}>
          <div>
            <h2 style={styles.sectionTitle}>Quick access</h2>
            <p style={styles.sectionDesc}>
              Open the tools you use most often.
            </p>
          </div>
        </div>

        <div className="dashboard-grid" style={styles.grid}>
          {cards.map(card => (
            <button
              key={card.route}
              type="button"
              style={styles.card}
              onClick={() => navigate(card.route)}
              className="dashboard-card"
            >
              <div style={styles.cardTop}>
                <span style={styles.cardIcon} aria-hidden="true">
                  {card.shortLabel}
                </span>

                <span
                  className="dashboard-arrow"
                  style={styles.arrow}
                  aria-hidden="true"
                >
                  →
                </span>
              </div>

              <h3 style={styles.cardTitle}>{card.title}</h3>

              <p style={styles.cardDesc}>{card.desc}</p>

              <span style={styles.openText}>Open module</span>
            </button>
          ))}
        </div>
      </section>

      <style>{`
        .dashboard-page {
          width: 100%;
          max-width: 100%;
          min-width: 0;
          overflow-x: hidden;
        }

        .dashboard-card:hover {
          transform: translateY(-2px);
          border-color: #bfdbfe;
          box-shadow: 0 10px 24px rgba(15, 23, 42, 0.08);
        }

        .dashboard-card:hover .dashboard-arrow {
          transform: translateX(3px);
        }

        @media (max-width: 700px) {
          .dashboard-grid {
            grid-template-columns: 1fr !important;
          }

          .dashboard-hero {
            padding: 1.15rem !important;
          }

          .dashboard-user-badge {
            width: 100% !important;
            min-width: 0 !important;
          }
        }

        @media (max-width: 480px) {
          .dashboard-hero {
            border-radius: 12px !important;
            padding: 1rem !important;
          }

          .dashboard-card {
            min-height: 175px !important;
            padding: 1rem !important;
          }
        }
      `}</style>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  hero: {
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    boxSizing: 'border-box',
    background:
      'linear-gradient(135deg, #172554 0%, #1e3a8a 65%, #2563eb 100%)',
    borderRadius: 16,
    padding: '1.5rem',
    color: '#fff',
    boxShadow: '0 10px 28px rgba(15, 23, 42, 0.12)',
    marginBottom: '1.5rem',
    overflow: 'hidden',
  },

  heroContent: {
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    boxSizing: 'border-box',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '1rem',
    flexWrap: 'wrap',
  },

  heroText: {
    minWidth: 0,
    maxWidth: '100%',
  },

  eyebrow: {
    display: 'inline-block',
    marginBottom: '0.45rem',
    color: 'rgba(255,255,255,0.65)',
    fontSize: '0.68rem',
    fontWeight: 800,
    letterSpacing: '0.09em',
  },

  title: {
    margin: 0,
    maxWidth: '100%',
    fontSize: 'clamp(1.45rem, 6vw, 2.15rem)',
    lineHeight: 1.15,
    fontWeight: 800,
    letterSpacing: '-0.03em',
    overflowWrap: 'anywhere',
  },

  subtitle: {
    margin: '0.55rem 0 0',
    maxWidth: '100%',
    color: 'rgba(255,255,255,0.72)',
    fontSize: '0.92rem',
    overflowWrap: 'anywhere',
  },

  userBadge: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    minWidth: 150,
    maxWidth: '100%',
    boxSizing: 'border-box',
    padding: '0.75rem 0.9rem',
    borderRadius: 10,
    background: 'rgba(255,255,255,0.1)',
    border: '1px solid rgba(255,255,255,0.12)',
  },

  userBadgeLabel: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: '0.68rem',
  },

  userBadgeName: {
    color: '#fff',
    fontSize: '0.84rem',
    overflowWrap: 'anywhere',
  },

  section: {
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    boxSizing: 'border-box',
    marginTop: '0.25rem',
  },

  sectionHeader: {
    marginBottom: '0.85rem',
  },

  sectionTitle: {
    margin: 0,
    color: colors.text,
    fontSize: '1.05rem',
    fontWeight: 750,
  },

  sectionDesc: {
    margin: '0.2rem 0 0',
    color: colors.muted,
    fontSize: '0.82rem',
  },

  grid: {
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    boxSizing: 'border-box',
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))',
    gap: '1rem',
  },

  card: {
    width: '100%',
    minWidth: 0,
    minHeight: 190,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    textAlign: 'left',
    background: colors.card,
    border: `1px solid ${colors.border}`,
    borderRadius: 14,
    padding: '1.15rem',
    boxSizing: 'border-box',
    cursor: 'pointer',
    boxShadow: '0 4px 16px rgba(15, 23, 42, 0.04)',
    transition:
      'transform 150ms ease, box-shadow 150ms ease, border-color 150ms ease',
  },

  cardTop: {
    width: '100%',
    minWidth: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '1rem',
  },

  cardIcon: {
    width: 40,
    height: 40,
    flex: '0 0 40px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    background: '#eff6ff',
    color: colors.accent,
    fontSize: '0.7rem',
    fontWeight: 800,
    letterSpacing: '0.03em',
  },

  arrow: {
    color: '#94a3b8',
    fontSize: '1.15rem',
    transition: 'transform 150ms ease',
  },

  cardTitle: {
    margin: '0 0 0.4rem',
    maxWidth: '100%',
    color: colors.text,
    fontSize: '1rem',
    fontWeight: 750,
    overflowWrap: 'anywhere',
  },

  cardDesc: {
    margin: 0,
    maxWidth: '100%',
    color: colors.muted,
    fontSize: '0.84rem',
    lineHeight: 1.55,
    overflowWrap: 'anywhere',
  },

  openText: {
    marginTop: 'auto',
    paddingTop: '1rem',
    color: colors.accent,
    fontSize: '0.75rem',
    fontWeight: 750,
  },
};
