import React, { FormEvent, useState } from 'react';
import { useAuth } from '../context/AuthContext.js';

export function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]     = useState<string | null>(null);
  const [busy, setBusy]       = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const err = await login({ username: username.trim(), password });
    if (err) setError(err);
    setBusy(false);
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.title}>School Office Assistant</h1>
        <p style={styles.subtitle}>Sign in to continue</p>

        <form onSubmit={handleSubmit} noValidate>
          <div style={styles.field}>
            <label htmlFor="username" style={styles.label}>Username</label>
            <input
              id="username"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={busy}
              required
              style={styles.input}
            />
          </div>

          <div style={styles.field}>
            <label htmlFor="password" style={styles.label}>Password</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={busy}
              required
              style={styles.input}
            />
          </div>

          {error && <p style={styles.error} role="alert">{error}</p>}

          <button type="submit" disabled={busy || !username || !password} style={styles.button}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#f0f2f5',
  },
  card: {
    background: '#fff',
    borderRadius: 8,
    padding: '2.5rem 2rem',
    width: '100%',
    maxWidth: 360,
    boxShadow: '0 2px 12px rgba(0,0,0,0.1)',
  },
  title: {
    margin: '0 0 0.25rem',
    fontSize: '1.3rem',
    fontWeight: 700,
    color: '#1a1a2e',
  },
  subtitle: {
    margin: '0 0 1.5rem',
    color: '#666',
    fontSize: '0.9rem',
  },
  field: {
    marginBottom: '1rem',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  label: {
    fontSize: '0.85rem',
    fontWeight: 600,
    color: '#333',
  },
  input: {
    padding: '0.55rem 0.75rem',
    border: '1px solid #ccc',
    borderRadius: 5,
    fontSize: '1rem',
    outline: 'none',
  },
  error: {
    color: '#c0392b',
    fontSize: '0.875rem',
    margin: '0 0 0.75rem',
  },
  button: {
    width: '100%',
    padding: '0.65rem',
    background: '#1a1a2e',
    color: '#fff',
    border: 'none',
    borderRadius: 5,
    fontSize: '1rem',
    fontWeight: 600,
    cursor: 'pointer',
    marginTop: '0.5rem',
    opacity: 1,
  },
};
