import { useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

import { useAuth } from '../context/AuthContext.jsx';

export function Login() {
  const { status, notice, login } = useAuth();
  const location = useLocation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Setelah login, kembali ke halaman yang tadi ingin dibuka.
  if (status === 'authenticated') {
    const from = location.state?.from;
    return <Navigate to={from ? `${from.pathname}${from.search}` : '/'} replace />;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(username, password);
    } catch (err) {
      setError(err.message);
      setPassword('');
    } finally {
      setSubmitting(false);
    }
  }

  const message = error ?? notice;

  return (
    <div className="login">
      <form className="login__card" onSubmit={handleSubmit}>
        <div className="login__brand">
          <span className="app__logo" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2.5S5.5 10 5.5 14.5a6.5 6.5 0 0 0 13 0C18.5 10 12 2.5 12 2.5z" />
              <path d="M10 16a2.5 2.5 0 0 0 2.5 2.5" opacity="0.6" />
            </svg>
          </span>
          <div>
            <h1 className="app__title">Smart Fish Pond</h1>
            <p className="app__subtitle">Masuk untuk memantau kolam</p>
          </div>
        </div>

        {message && (
          <p className="login__error" role="alert">
            {message}
          </p>
        )}

        <label className="login__field">
          <span>Username</span>
          <input
            type="text"
            name="username"
            autoComplete="username"
            autoFocus
            required
            value={username}
            onChange={(event) => setUsername(event.target.value)}
          />
        </label>

        <label className="login__field">
          <span>Password</span>
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>

        <button type="submit" className="btn login__submit" disabled={submitting}>
          {submitting ? 'Memeriksa...' : 'Masuk'}
        </button>
      </form>
    </div>
  );
}
