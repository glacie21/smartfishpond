import { lazy } from 'react';
import { Route, Routes } from 'react-router-dom';

import { Layout } from './components/Layout.jsx';
import { RequireAuth } from './components/RequireAuth.jsx';
import { Dashboard } from './pages/Dashboard.jsx';
import { Login } from './pages/Login.jsx';
import { NotFound } from './pages/NotFound.jsx';

// Dimuat saat dibuka: Recharts (grafik) hanya diunduh ketika detail kolam dibuka.
const named = (load, name) => lazy(() => load().then((m) => ({ default: m[name] })));
const PondDetail = named(() => import('./pages/PondDetail.jsx'), 'PondDetail');
const Devices = named(() => import('./pages/Devices.jsx'), 'Devices');
const Alerts = named(() => import('./pages/Alerts.jsx'), 'Alerts');

export default function App() {
  return (
    <Routes>
      <Route path="login" element={<Login />} />
      <Route element={<RequireAuth />}>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="ponds/:pondId" element={<PondDetail />} />
          <Route path="devices" element={<Devices />} />
          <Route path="alerts" element={<Alerts />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Route>
    </Routes>
  );
}
