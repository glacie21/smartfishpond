import { NavLink, Outlet } from 'react-router-dom';

/** Kerangka halaman: header navigasi + area konten. */
export function Layout() {
  const navClass = ({ isActive }) => `nav__link${isActive ? ' is-active' : ''}`;

  return (
    <div className="app">
      <header className="app__header">
        <div className="app__brand">
          <span className="app__logo" aria-hidden="true">SF</span>
          <div>
            <h1 className="app__title">Smart Fish Pond</h1>
            <p className="app__subtitle">Monitoring kualitas air kolam</p>
          </div>
        </div>

        <nav className="nav">
          <NavLink to="/" className={navClass} end>
            Dashboard
          </NavLink>
          <NavLink to="/devices" className={navClass}>
            Perangkat
          </NavLink>
        </nav>
      </header>

      <main className="app__main">
        <Outlet />
      </main>

      <footer className="app__footer">
        Smart Fish Pond IoT - ESP32 | MQTT | PostgreSQL
      </footer>
    </div>
  );
}
