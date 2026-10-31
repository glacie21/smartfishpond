import { Route, Routes } from 'react-router-dom';

import { Layout } from './components/Layout.jsx';
import { RequireAuth } from './components/RequireAuth.jsx';
import { Alerts } from './pages/Alerts.jsx';
import { Dashboard } from './pages/Dashboard.jsx';
import { Devices } from './pages/Devices.jsx';
import { Login } from './pages/Login.jsx';
import { NotFound } from './pages/NotFound.jsx';
import { PondDetail } from './pages/PondDetail.jsx';

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
