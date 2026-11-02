import { useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

import { Icon, Logo } from '../components/Icon.jsx';
import { Field } from '../components/ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export function Login() {
  const { status, notice, login } = useAuth();
  const location = useLocation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
      <form className="card login__card" onSubmit={handleSubmit}>
        <div className="login__brand">
          <Logo size={52} />
          <h1 className="login__title">Smart Fish Pond</h1>
          <p className="muted">Masuk untuk memantau kolam</p>
        </div>

        {message && (
          <p className="banner is-critical" role="alert">
            {message}
          </p>
        )}

        <Field label="Username">
          <input
            className="input"
            type="text"
            name="username"
            autoComplete="username"
            autoFocus
            required
            value={username}
            onChange={(event) => setUsername(event.target.value)}
          />
        </Field>

        <div className="field">
          <label className="field__label" htmlFor="login-password">
            Password
          </label>
          <div className="input-group">
            <input
              id="login-password"
              className="input"
              type={showPassword ? 'text' : 'password'}
              name="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <button
              type="button"
              className="icon-btn"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
              aria-pressed={showPassword}
            >
              <Icon name="eye" size={16} />
            </button>
          </div>
        </div>

        <button type="submit" className="btn btn--block" disabled={submitting}>
          {submitting ? 'Memeriksa...' : 'Masuk'}
        </button>
      </form>
    </div>
  );
}
