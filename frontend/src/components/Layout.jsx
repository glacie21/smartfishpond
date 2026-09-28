import { NavLink, Outlet } from 'react-router-dom';

/** Kerangka halaman: header navigasi glassmorphism + area konten. */
export function Layout() {
  const navClass = ({ isActive }) => `nav__link${isActive ? ' is-active' : ''}`;

  return (
    <div className="app">
      <header className="app__header">
        <div className="app__brand">
          <span className="app__logo" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2.5S5.5 10 5.5 14.5a6.5 6.5 0 0 0 13 0C18.5 10 12 2.5 12 2.5z" />
              <path d="M10 16a2.5 2.5 0 0 0 2.5 2.5" opacity="0.6" />
            </svg>
          </span>
          <div>
            <h1 className="app__title">Smart Fish Pond</h1>
            <p className="app__subtitle">Monitoring kualitas air kolam</p>
          </div>
        </div>

        <nav className="nav">
          <NavLink to="/" className={navClass} end>
            <span aria-hidden="true" style={{ marginRight: 6 }}>📊</span>
            Dashboard
          </NavLink>
          <NavLink to="/devices" className={navClass}>
            <span aria-hidden="true" style={{ marginRight: 6 }}>📡</span>
            Perangkat
          </NavLink>
        </nav>
      </header>

      <main className="app__main">
        <Outlet />
      </main>

      <footer className="app__footer">
        <span style={{ opacity: 0.5 }}>⚡</span> Smart Fish Pond IoT — ESP32 · MQTT · PostgreSQL
      </footer>
    </div>
  );
}
