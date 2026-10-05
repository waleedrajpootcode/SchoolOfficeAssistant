import type { CSSProperties } from 'react';

export const colors = {
  primary: '#123B5D',
  primarySoft: '#1F5A85',
  accent: '#1677C8',
  background: '#F4F7FA',
  card: '#FFFFFF',
  border: '#D9E2EC',
  text: '#172B3A',
  muted: '#64748b',
  danger: '#dc2626',
  success: '#15803d',
  warning: '#b45309',
  info: '#2563eb',
  surfaceSoft: '#f8fafc',
  hover: '#f1f5f9',
} as const;

export const s: Record<string, CSSProperties> = {
  pageTitle: {
    margin: '0 0 0.35rem',
    fontSize: 'clamp(1.45rem, 2vw, 1.8rem)',
    lineHeight: 1.2,
    fontWeight: 750,
    letterSpacing: '-0.025em',
    color: colors.text,
  },

  card: {
    background: colors.card,
    border: `1px solid ${colors.border}`,
    borderRadius: 14,
    padding: '1.25rem',
    boxShadow: '0 4px 18px rgba(15, 23, 42, 0.05)',
    marginBottom: '1rem',
  },

  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.85rem',
  },

  formTitle: {
    margin: '0 0 0.25rem',
    fontSize: '1.05rem',
    fontWeight: 700,
    color: colors.text,
  },

  row: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.65rem',
    alignItems: 'flex-end',
  },

  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    minWidth: 0,
    flex: '1 1 auto',
  },

  label: {
    fontSize: '0.78rem',
    fontWeight: 700,
    color: colors.muted,
    letterSpacing: '0.01em',
  },

  input: {
    padding: '0.65rem 0.8rem',
    border: `1px solid ${colors.border}`,
    borderRadius: 8,
    fontSize: '0.94rem',
    outline: 'none',
    backgroundColor: colors.card,
    color: colors.text,
    minWidth: 0,
    width: '100%',
    transition: 'border-color 150ms ease, box-shadow 150ms ease',
  },

  select: {
    padding: '0.65rem 0.8rem',
    border: `1px solid ${colors.border}`,
    borderRadius: 8,
    fontSize: '0.94rem',
    outline: 'none',
    backgroundColor: colors.card,
    color: colors.text,
    minWidth: 0,
    width: '100%',
    cursor: 'pointer',
  },

  btn: {
    padding: '0.62rem 1rem',
    background: colors.accent,
    color: '#fff',
    border: '1px solid transparent',
    borderRadius: 8,
    fontSize: '0.9rem',
    fontWeight: 700,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    boxShadow: '0 2px 6px rgba(37, 99, 235, 0.2)',
    transition: 'transform 120ms ease, box-shadow 120ms ease, background 120ms ease',
  },

  btnSecondary: {
    padding: '0.62rem 1rem',
    background: colors.card,
    color: colors.primary,
    border: `1px solid ${colors.border}`,
    borderRadius: 8,
    fontSize: '0.9rem',
    fontWeight: 700,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    transition: 'background 120ms ease, border-color 120ms ease',
  },

  btnDanger: {
    padding: '0.62rem 1rem',
    background: '#fff',
    color: colors.danger,
    border: `1px solid #fecaca`,
    borderRadius: 8,
    fontSize: '0.9rem',
    fontWeight: 700,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    transition: 'background 120ms ease, border-color 120ms ease',
  },

  btnSmall: {
    padding: '0.35rem 0.65rem',
    fontSize: '0.8rem',
    borderRadius: 7,
  },

  tableWrap: {
    overflowX: 'auto',
    WebkitOverflowScrolling: 'touch',
    border: `1px solid ${colors.border}`,
    borderRadius: 12,
  },

  table: {
    width: '100%',
    borderCollapse: 'separate',
    borderSpacing: 0,
    background: colors.card,
    fontSize: '0.9rem',
    minWidth: 0,
  },

  th: {
    textAlign: 'left',
    padding: '0.72rem 0.8rem',
    borderBottom: `1px solid ${colors.border}`,
    background: colors.surfaceSoft,
    color: colors.muted,
    fontWeight: 750,
    fontSize: '0.74rem',
    textTransform: 'uppercase',
    letterSpacing: '0.055em',
    whiteSpace: 'nowrap',
  },

  td: {
    padding: '0.72rem 0.8rem',
    borderBottom: `1px solid ${colors.border}`,
    verticalAlign: 'middle',
    color: colors.text,
  },

  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '0.22rem 0.62rem',
    borderRadius: 999,
    fontSize: '0.74rem',
    fontWeight: 750,
    whiteSpace: 'nowrap',
    lineHeight: 1.2,
  },

  badgeGreen: {
    background: '#ecfdf3',
    color: colors.success,
  },

  badgeRed: {
    background: '#fef2f2',
    color: colors.danger,
  },

  badgeGrey: {
    background: '#f1f5f9',
    color: colors.muted,
  },

  badgeBlue: {
    background: '#eff6ff',
    color: colors.info,
  },

  badgeAmber: {
    background: '#fffbeb',
    color: colors.warning,
  },

  errText: {
    color: colors.danger,
    fontSize: '0.875rem',
    margin: '0.5rem 0',
    fontWeight: 500,
  },

  okText: {
    color: colors.success,
    fontSize: '0.875rem',
    margin: '0.5rem 0',
    fontWeight: 500,
  },

  empty: {
    textAlign: 'center',
    color: colors.muted,
    padding: '2.5rem 1rem',
    fontSize: '0.92rem',
  },

  muted: {
    color: colors.muted,
    fontSize: '0.85rem',
  },

  spinner: {
    textAlign: 'center',
    color: colors.muted,
    padding: '1.5rem 0',
    fontSize: '0.92rem',
  },

  actions: {
    display: 'flex',
    gap: '0.45rem',
    flexWrap: 'wrap',
  },

  flex: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    flexWrap: 'wrap',
  },

  between: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: '0.65rem',
    marginBottom: '0.85rem',
  },

  modal: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(15, 23, 42, 0.48)',
    backdropFilter: 'blur(3px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
    padding: '1rem',
  },

  modalCard: {
    background: colors.card,
    border: `1px solid ${colors.border}`,
    borderRadius: 16,
    padding: '1.5rem',
    width: '100%',
    maxWidth: 520,
    maxHeight: '90vh',
    overflowY: 'auto',
    boxShadow: '0 20px 50px rgba(15, 23, 42, 0.18)',
  },

  modalTitle: {
    margin: '0 0 1rem',
    fontSize: '1.12rem',
    fontWeight: 750,
    color: colors.text,
    letterSpacing: '-0.015em',
  },

  modalActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '0.55rem',
    marginTop: '1.1rem',
  },
    mobileCard: {
    background: colors.card,
    border: `1px solid ${colors.border}`,
    borderRadius: 12,
    padding: '1rem',
    boxShadow: '0 3px 12px rgba(15, 23, 42, 0.05)',
    marginBottom: '0.8rem',
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    boxSizing: 'border-box',
    overflow: 'hidden',
  },

  mobileCardTitle: {
    margin: 0,
    fontSize: '0.98rem',
    fontWeight: 700,
    color: colors.text,
    overflowWrap: 'anywhere',
  },

  mobileCardText: {
    margin: '0.25rem 0 0',
    fontSize: '0.84rem',
    color: colors.muted,
    overflowWrap: 'anywhere',
  },

  mobileCardActions: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.45rem',
    marginTop: '0.75rem',
    width: '100%',
    maxWidth: '100%',
  },
};
 