import React from 'react';
import type { CSSProperties } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { navigate, type RouteName } from '../router.js';
import { colors } from '../styles/shared.js';
import { parentAlertsApi, type ParentAlert } from '../api/parentAlerts.js';

interface Card {
  route: RouteName;
  title: string;
  desc: string;
  shortLabel: string;
}

export function Dashboard() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [parentAlerts, setParentAlerts] = React.useState<ParentAlert[]>([]);
  const [selectedAlerts, setSelectedAlerts] = React.useState<string[]>([]);
  const [alertsLoading, setAlertsLoading] = React.useState(false);
  const [alertsError, setAlertsError] = React.useState<string | null>(null);
  const [whatsappQueue, setWhatsappQueue] = React.useState<ParentAlert[]>([]);
  const [whatsappIndex, setWhatsappIndex] = React.useState(0);

  React.useEffect(() => {
    if (!isAdmin) return;

    let cancelled = false;

    async function loadParentAlerts() {
      setAlertsLoading(true);
      setAlertsError(null);

      try {
        const alerts = await parentAlertsApi.list();

        if (!cancelled) {
          setParentAlerts(alerts);
          setSelectedAlerts(current =>
            current.filter(id => alerts.some(alert => alert.id === id))
          );
        }
      } catch (error) {
        if (!cancelled) {
          setAlertsError(
            error instanceof Error
              ? error.message
              : 'Unable to load parent alerts.'
          );
        }
      } finally {
        if (!cancelled) {
          setAlertsLoading(false);
        }
      }
    }

    void loadParentAlerts();

    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  function toggleAlert(id: string) {
    setSelectedAlerts(current =>
      current.includes(id)
        ? current.filter(item => item !== id)
        : [...current, id]
    );
  }

  function toggleAllAlerts() {
    const sendable = parentAlerts.filter(alert => alert.guardianPhone.trim());

    setSelectedAlerts(current =>
      current.length === sendable.length && sendable.length > 0
        ? []
        : sendable.map(alert => alert.id)
    );
  }

  function openWhatsApp(alert: ParentAlert) {
    let phone = alert.guardianPhone.replace(/\D/g, '');

    if (phone.startsWith('00')) {
      phone = phone.slice(2);
    }

    if (phone.startsWith('0')) {
      phone = `92${phone.slice(1)}`;
    }

    if (!phone) return;

    window.open(
      `https://wa.me/${phone}?text=${encodeURIComponent(alert.message)}`,
      '_blank',
      'noopener,noreferrer'
    );
  }

  function startWhatsAppQueue(alerts: ParentAlert[]) {
    const sendable = alerts.filter(alert => alert.guardianPhone.trim());

    if (sendable.length === 0) return;

    setWhatsappQueue(sendable);
    setWhatsappIndex(0);
    openWhatsApp(sendable[0]);
  }

  function closeWhatsAppQueue() {
    setWhatsappQueue([]);
    setWhatsappIndex(0);
  }

  function openNextWhatsApp() {
    const nextIndex = whatsappIndex + 1;

    if (nextIndex >= whatsappQueue.length) {
      closeWhatsAppQueue();
      return;
    }

    setWhatsappIndex(nextIndex);
    openWhatsApp(whatsappQueue[nextIndex]);
  }

  const selectedParentAlerts = parentAlerts.filter(alert =>
    selectedAlerts.includes(alert.id)
  );

  const sendableSelectedCount = selectedParentAlerts.filter(alert =>
    alert.guardianPhone.trim()
  ).length;

  const sendableAllCount = parentAlerts.filter(alert =>
    alert.guardianPhone.trim()
  ).length;

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

      {isAdmin && (
        <section style={styles.alertSection}>
          <div style={styles.alertHeader}>
            <div>
              <div style={styles.alertTitleRow}>
                <h2 style={styles.sectionTitle}>Parent Alerts</h2>
                {parentAlerts.length > 0 && (
                  <span style={styles.alertCount}>{parentAlerts.length}</span>
                )}
              </div>
              <p style={styles.sectionDesc}>
                Automatic alerts for overdue fees and today&apos;s absences.
              </p>
            </div>

            {parentAlerts.length > 0 && (
              <div style={styles.alertActions}>
                <button
                  type="button"
                  style={styles.secondaryButton}
                  onClick={toggleAllAlerts}
                >
                  {selectedAlerts.length === sendableAllCount && sendableAllCount > 0
                    ? 'Clear All'
                    : 'Select All'}
                </button>

                <button
                  type="button"
                  style={styles.primaryButton}
                  disabled={sendableSelectedCount === 0}
                  onClick={() => startWhatsAppQueue(selectedParentAlerts)}
                >
                  Send Selected ({sendableSelectedCount})
                </button>

                <button
                  type="button"
                  style={styles.primaryButton}
                  disabled={sendableAllCount === 0}
                  onClick={() => startWhatsAppQueue(parentAlerts)}
                >
                  Send All ({sendableAllCount})
                </button>
              </div>
            )}
          </div>

          {alertsLoading && (
            <div style={styles.alertEmpty}>
              Checking for new parent alerts...
            </div>
          )}

          {alertsError && !alertsLoading && (
            <div style={styles.alertError}>
              {alertsError}
            </div>
          )}

          {!alertsLoading && !alertsError && parentAlerts.length === 0 && (
            <div style={styles.alertEmpty}>
              <strong>No action needed.</strong>
              <span>No overdue fees or absences detected for today.</span>
            </div>
          )}

          {!alertsLoading && parentAlerts.length > 0 && (
            <div style={styles.alertList}>
              {parentAlerts.map(alert => {
                const hasPhone = Boolean(alert.guardianPhone.trim());
                const checked = selectedAlerts.includes(alert.id);

                return (
                  <div
                    key={alert.id}
                    className="parent-alert-item"
                    style={{
                      ...styles.alertItem,
                      ...(checked ? styles.alertItemSelected : {}),
                    }}
                  >
                    <label style={styles.alertCheck}>
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={!hasPhone}
                        onChange={() => toggleAlert(alert.id)}
                      />
                    </label>

                    <div style={styles.alertMain}>
                      <div style={styles.alertItemTop}>
                        <div style={styles.alertStudent}>
                          <strong>{alert.studentName}</strong>
                          <span>Roll {alert.rollNumber} ? {alert.className}</span>
                        </div>

                        <span
                          style={
                            alert.type === 'fee'
                              ? styles.feeBadge
                              : styles.absenceBadge
                          }
                        >
                          {alert.type === 'fee' ? 'FEE OVERDUE' : 'ABSENT TODAY'}
                        </span>
                      </div>

                      <div style={styles.alertGuardian}>
                        <span>Guardian: {alert.guardianName}</span>
                        <span>
                          {hasPhone
                            ? alert.guardianPhone
                            : 'No guardian WhatsApp number'}
                        </span>
                      </div>

                      <p style={styles.alertMessage}>{alert.message}</p>

                      {alert.type === 'fee' && (
                        <div style={styles.alertMeta}>
                          <span>
                            Fee Outstanding: Rs.{' '}
                            {alert.amountRemaining?.toLocaleString('en-PK')}
                          </span>

                          <span>
                            Fine: Rs.{' '}
                            {(alert.appliedFine ?? 0).toLocaleString('en-PK')}
                            {(alert.appliedFine ?? 0) > 0
                              ? ' (Applied)'
                              : ''}
                          </span>

                          <span>
                            Total Payable: Rs.{' '}
                            {(alert.totalPayable ?? 0).toLocaleString('en-PK')}
                          </span>

                          <span>
                            Total Remaining: Rs.{' '}
                            {(alert.totalRemaining ?? alert.amountRemaining ?? 0)
                              .toLocaleString('en-PK')}
                          </span>

                          <span>
                            Last Date: {alert.dueDate || '?'}
                          </span>

                          <span>
                            {alert.daysOverdue} day
                            {alert.daysOverdue === 1 ? '' : 's'} overdue
                          </span>
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      style={hasPhone ? styles.whatsappButton : styles.disabledButton}
                      disabled={!hasPhone}
                      onClick={() => openWhatsApp(alert)}
                    >
                      {hasPhone ? 'WhatsApp' : 'No Number'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {whatsappQueue.length > 0 && (
            <div style={styles.queueBox}>
              <div>
                <strong>
                  WhatsApp Queue: {whatsappIndex + 1} of {whatsappQueue.length}
                </strong>
                <span>
                  WhatsApp opened with the message ready. Press Send in WhatsApp,
                  then continue to the next parent.
                </span>
              </div>

              <div style={styles.queueActions}>
                <button
                  type="button"
                  style={styles.secondaryButton}
                  onClick={closeWhatsAppQueue}
                >
                  Close
                </button>

                <button
                  type="button"
                  style={styles.primaryButton}
                  onClick={openNextWhatsApp}
                >
                  {whatsappIndex + 1 >= whatsappQueue.length
                    ? 'Finish'
                    : 'Next Parent'}
                </button>
              </div>
            </div>
          )}
        </section>
      )}

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

        .dashboard-card {
          position: relative;
          overflow: hidden;
        }

        .dashboard-card::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(
            135deg,
            rgba(37, 99, 235, 0.055) 0%,
            rgba(56, 189, 248, 0.025) 48%,
            rgba(99, 102, 241, 0.045) 100%
          );
          opacity: 0;
          pointer-events: none;
          transition: opacity 180ms ease;
        }

        .dashboard-card:hover {
          transform: translateY(-4px);
          border-color: #93c5fd;
          box-shadow:
            0 16px 34px rgba(15, 23, 42, 0.10),
            0 0 0 1px rgba(37, 99, 235, 0.04);
        }

        .dashboard-card:hover::before {
          opacity: 1;
        }

        .dashboard-card:hover .dashboard-arrow {
          transform: translateX(5px);
        }

        .dashboard-card:active {
          transform: translateY(-1px);
        }

        .dashboard-card:focus-visible {
          outline: 3px solid rgba(37, 99, 235, 0.18);
          outline-offset: 2px;
        }

        .dashboard-page button:not(.dashboard-card):not(:disabled):hover {
          transform: translateY(-1px);
          filter: brightness(1.02);
        }

        .dashboard-page button:not(.dashboard-card):not(:disabled):active {
          transform: translateY(0);
        }

        .dashboard-page button:not(.dashboard-card):focus-visible {
          outline: 3px solid rgba(37, 99, 235, 0.16);
          outline-offset: 2px;
        }

        .parent-alert-item:hover {
          transform: translateY(-1px);
          border-color: #cbd5e1;
          box-shadow: 0 8px 20px rgba(15, 23, 42, 0.055);
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

          .parent-alert-item {
            flex-wrap: wrap;
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
      'linear-gradient(135deg, #0f2740 0%, #123b5d 42%, #1677c8 78%, #38bdf8 100%)',
    borderRadius: 18,
    padding: '1.65rem',
    color: '#fff',
    boxShadow:
      '0 18px 42px rgba(18, 59, 93, 0.18), 0 2px 8px rgba(15, 23, 42, 0.08)',
    marginBottom: '1.5rem',
    overflow: 'hidden',
    position: 'relative',
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
    gap: 3,
    minWidth: 150,
    maxWidth: '100%',
    boxSizing: 'border-box',
    padding: '0.8rem 1rem',
    borderRadius: 12,
    background:
      'linear-gradient(135deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.07) 100%)',
    border: '1px solid rgba(255,255,255,0.18)',
    boxShadow:
      'inset 0 1px 0 rgba(255,255,255,0.12), 0 10px 24px rgba(15,23,42,0.12)',
    backdropFilter: 'blur(10px)',
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

  alertSection: {
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    boxSizing: 'border-box',
    marginBottom: '1.5rem',
    padding: '1.1rem',
    border: `1px solid ${colors.border}`,
    borderRadius: 16,
    background:
      'linear-gradient(180deg, #ffffff 0%, #fbfdff 100%)',
    boxShadow:
      '0 10px 28px rgba(15, 23, 42, 0.055), 0 1px 3px rgba(15, 23, 42, 0.04)',
  },

  alertHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '1rem',
    flexWrap: 'wrap',
    marginBottom: '0.9rem',
  },

  alertTitleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },

  alertCount: {
    minWidth: 25,
    height: 25,
    padding: '0 0.45rem',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    background: 'linear-gradient(135deg, #fff1f2 0%, #fee2e2 100%)',
    border: '1px solid #fecaca',
    color: '#b91c1c',
    fontSize: '0.72rem',
    fontWeight: 800,
    boxShadow: '0 3px 9px rgba(185, 28, 28, 0.08)',
  },

  alertActions: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: '0.5rem',
    flexWrap: 'wrap',
  },

  primaryButton: {
    border: '1px solid rgba(18, 59, 93, 0.12)',
    borderRadius: 9,
    padding: '0.58rem 0.8rem',
    background:
      'linear-gradient(135deg, #123b5d 0%, #1677c8 72%, #38bdf8 100%)',
    color: '#fff',
    fontSize: '0.74rem',
    fontWeight: 750,
    cursor: 'pointer',
    boxShadow: '0 5px 13px rgba(18, 59, 93, 0.16)',
    transition:
      'transform 160ms ease, box-shadow 160ms ease, filter 160ms ease',
  },

  secondaryButton: {
    border: `1px solid ${colors.border}`,
    borderRadius: 9,
    padding: '0.58rem 0.8rem',
    background: 'linear-gradient(135deg, #ffffff 0%, #f8fbff 100%)',
    color: colors.text,
    fontSize: '0.74rem',
    fontWeight: 700,
    cursor: 'pointer',
    boxShadow: '0 4px 11px rgba(15, 23, 42, 0.045)',
    transition:
      'transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease',
  },

  alertList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.65rem',
  },

  alertItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.8rem',
    padding: '0.9rem',
    border: `1px solid ${colors.border}`,
    borderRadius: 12,
    background: 'linear-gradient(135deg, #ffffff 0%, #fbfdff 100%)',
    boxSizing: 'border-box',
    boxShadow: '0 3px 12px rgba(15, 23, 42, 0.025)',
    transition:
      'transform 160ms ease, border-color 160ms ease, box-shadow 160ms ease',
  },

  alertItemSelected: {
    borderColor: '#60a5fa',
    background:
      'linear-gradient(135deg, #eff6ff 0%, #ffffff 100%)',
    boxShadow:
      '0 0 0 2px rgba(37, 99, 235, 0.08), 0 8px 18px rgba(37, 99, 235, 0.06)',
  },

  alertCheck: {
    paddingTop: 2,
    display: 'flex',
    flex: '0 0 auto',
  },

  alertMain: {
    flex: '1 1 auto',
    minWidth: 0,
  },

  alertItemTop: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '0.75rem',
    flexWrap: 'wrap',
  },

  alertStudent: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    minWidth: 0,
  },

  feeBadge: {
    padding: '0.3rem 0.52rem',
    borderRadius: 999,
    background: 'linear-gradient(135deg, #fff7ed 0%, #fef3c7 100%)',
    border: '1px solid #fde68a',
    color: '#92400e',
    fontSize: '0.62rem',
    fontWeight: 800,
    letterSpacing: '0.03em',
    boxShadow: '0 3px 8px rgba(146, 64, 14, 0.07)',
  },

  absenceBadge: {
    padding: '0.3rem 0.52rem',
    borderRadius: 999,
    background: 'linear-gradient(135deg, #fff1f2 0%, #fee2e2 100%)',
    border: '1px solid #fecaca',
    color: '#b91c1c',
    fontSize: '0.62rem',
    fontWeight: 800,
    letterSpacing: '0.03em',
    boxShadow: '0 3px 8px rgba(185, 28, 28, 0.07)',
  },

  alertGuardian: {
    display: 'flex',
    gap: '0.75rem',
    flexWrap: 'wrap',
    marginTop: '0.35rem',
    color: colors.muted,
    fontSize: '0.72rem',
  },

  alertMessage: {
    margin: '0.55rem 0 0',
    color: colors.text,
    fontSize: '0.78rem',
    lineHeight: 1.5,
  },

  alertMeta: {
    display: 'flex',
    gap: '0.75rem',
    flexWrap: 'wrap',
    marginTop: '0.45rem',
    color: colors.muted,
    fontSize: '0.7rem',
    fontWeight: 650,
  },

  whatsappButton: {
    flex: '0 0 auto',
    border: '1px solid rgba(21, 128, 61, 0.18)',
    borderRadius: 9,
    padding: '0.58rem 0.74rem',
    background: 'linear-gradient(135deg, #15803d 0%, #22c55e 100%)',
    color: '#fff',
    fontSize: '0.7rem',
    fontWeight: 750,
    cursor: 'pointer',
    boxShadow: '0 5px 13px rgba(21, 128, 61, 0.16)',
    transition:
      'transform 160ms ease, box-shadow 160ms ease, filter 160ms ease',
  },

  disabledButton: {
    flex: '0 0 auto',
    border: `1px solid ${colors.border}`,
    borderRadius: 8,
    padding: '0.55rem 0.7rem',
    background: '#f8fafc',
    color: '#94a3b8',
    fontSize: '0.7rem',
    fontWeight: 700,
    cursor: 'not-allowed',
  },

  alertEmpty: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.2rem',
    padding: '1rem',
    borderRadius: 10,
    background: '#f8fafc',
    color: colors.muted,
    fontSize: '0.78rem',
  },

  alertError: {
    padding: '0.8rem',
    borderRadius: 10,
    background: '#fef2f2',
    color: '#b91c1c',
    fontSize: '0.78rem',
  },

  queueBox: {
    marginTop: '0.85rem',
    padding: '0.9rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.85rem',
    flexWrap: 'wrap',
    borderRadius: 12,
    background:
      'linear-gradient(135deg, #eff6ff 0%, #f0f9ff 55%, #ecfeff 100%)',
    border: '1px solid #bfdbfe',
    boxShadow: '0 7px 18px rgba(37, 99, 235, 0.07)',
  },

  queueActions: {
    display: 'flex',
    gap: '0.5rem',
    flexWrap: 'wrap',
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
    minHeight: 196,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    textAlign: 'left',
    background:
      'linear-gradient(145deg, #ffffff 0%, #fbfdff 58%, #f7fbff 100%)',
    border: `1px solid ${colors.border}`,
    borderRadius: 16,
    padding: '1.2rem',
    boxSizing: 'border-box',
    cursor: 'pointer',
    boxShadow:
      '0 7px 20px rgba(15, 23, 42, 0.045), 0 1px 3px rgba(15, 23, 42, 0.035)',
    transition:
      'transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease',
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
    width: 44,
    height: 44,
    flex: '0 0 44px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
    background:
      'linear-gradient(135deg, #dbeafe 0%, #e0f2fe 58%, #cffafe 100%)',
    border: '1px solid rgba(37, 99, 235, 0.10)',
    color: colors.primary,
    fontSize: '0.7rem',
    fontWeight: 850,
    letterSpacing: '0.03em',
    boxShadow:
      '0 6px 14px rgba(37, 99, 235, 0.10), inset 0 1px 0 rgba(255,255,255,0.75)',
  },

  arrow: {
    color: colors.accent,
    fontSize: '1.2rem',
    fontWeight: 700,
    transition:
      'transform 180ms ease, color 180ms ease',
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
    color: colors.primarySoft,
    fontSize: '0.75rem',
    fontWeight: 750,
    letterSpacing: '0.01em',
  },
};
