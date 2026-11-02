import { Suspense, useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';

import { METRIC_BY_KEY } from '../constants/metrics.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useAlertFeed } from '../hooks/useAlerts.js';
import { useTheme } from '../hooks/useTheme.js';
import { Icon, Logo } from './Icon.jsx';
import { ErrorBoundary, Loading } from './StateViews.jsx';

const ROLE_LABEL = { admin: 'Admin', viewer: 'Viewer' };
const THEME_META = {
  system: { icon: 'monitor', label: 'Tema mengikuti sistem' },
  light: { icon: 'sun', label: 'Tema terang' },
  dark: { icon: 'moon', label: 'Tema gelap' },
};
const NAV = [
  { to: '/', label: 'Dashboard', icon: 'grid', end: true },
  { to: '/devices', label: 'Perangkat', icon: 'cpu' },
  { to: '/alerts', label: 'Alert', icon: 'bell' },
];
const TOAST_MS = 8000;

/** Toast untuk alert yang baru terbuka selama dashboard dibuka. */
function useNewAlertToasts(alerts, loading) {
  const [toasts, setToasts] = useState([]);
  const seen = useRef(null);

  useEffect(() => {
    if (loading) return;
    const fresh = seen.current ? alerts.filter((a) => !seen.current.has(a.id)) : [];
    seen.current = new Set(alerts.map((a) => a.id));
    if (fresh.length) setToasts((list) => [...fresh, ...list].slice(0, 4));
  }, [alerts, loading]);

  useEffect(() => {
    if (!toasts.length) return undefined;
    const timer = setTimeout(() => setToasts((list) => list.slice(0, -1)), TOAST_MS);
    return () => clearTimeout(timer);
  }, [toasts]);

  const dismiss = (id) => setToasts((list) => list.filter((t) => t.id !== id));
  return { toasts, dismiss };
}

function Toasts({ toasts, onDismiss }) {
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((alert) => (
        <div key={alert.id} className={`toast is-${alert.severity}`} role="status">
          <Icon name="alert" />
          <Link to={`/ponds/${alert.pond_id}`} className="toast__body" onClick={() => onDismiss(alert.id)}>
            <strong>
              {alert.type === 'device_offline' ? 'Perangkat offline' : METRIC_BY_KEY[alert.metric]?.label} ·{' '}
              {alert.pond_name ?? alert.pond_id}
            </strong>
            <span>{alert.message}</span>
          </Link>
          <button type="button" className="icon-btn" onClick={() => onDismiss(alert.id)} aria-label="Tutup">
            <Icon name="close" size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}

/**
 * Kerangka halaman: header navigasi + area konten. Feed alert terbuka dimuat
 * sekali di sini dan dibagikan ke halaman lewat `useOutletContext()`.
 */
export function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const { preference, cycle } = useTheme();
  const openAlerts = useAlertFeed({ status: 'open' });
  const { alerts } = openAlerts;
  const critical = alerts.some((a) => a.severity === 'critical');
  const { toasts, dismiss } = useNewAlertToasts(alerts, openAlerts.loading);

  // Jumlah alert di judul tab: terlihat meski dashboard tidak sedang dibuka.
  useEffect(() => {
    document.title = `${alerts.length ? `(${alerts.length}) ` : ''}Smart Fish Pond`;
  }, [alerts.length]);

  return (
    <div className="app">
      <a href="#main" className="skip-link">
        Lompat ke konten
      </a>

      <header className="app__header">
        <Link to="/" className="brand">
          <Logo />
          <span>
            <span className="brand__title">Smart Fish Pond</span>
            <span className="brand__subtitle">Monitoring kualitas air</span>
          </span>
        </Link>

        <nav className="nav" aria-label="Menu utama">
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className="nav__link">
              <Icon name={item.icon} />
              <span>{item.label}</span>
              {item.to === '/alerts' && alerts.length > 0 && (
                <span className={`nav__badge${critical ? ' is-critical' : ''}`} aria-label={`${alerts.length} alert aktif`}>
                  {alerts.length}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="user-menu">
          <button
            type="button"
            className="icon-btn"
            onClick={cycle}
            title={THEME_META[preference].label}
            aria-label={`${THEME_META[preference].label} — klik untuk mengganti`}
          >
            <Icon name={THEME_META[preference].icon} />
          </button>
          <span className="user-menu__name">
            {user?.username}
            <small>{ROLE_LABEL[user?.role] ?? user?.role}</small>
          </span>
          <button type="button" className="icon-btn" onClick={logout} title="Keluar" aria-label="Keluar">
            <Icon name="logout" />
          </button>
        </div>
      </header>

      <main id="main" className="app__main">
        <ErrorBoundary key={location.pathname}>
          <Suspense fallback={<Loading />}>
            <Outlet context={openAlerts} />
          </Suspense>
        </ErrorBoundary>
      </main>

      <footer className="app__footer">Smart Fish Pond IoT — ESP32 · MQTT · PostgreSQL</footer>
      <Toasts toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
