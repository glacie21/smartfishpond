import { Route, Routes } from 'react-router-dom';

import { Layout } from './components/Layout.jsx';
import { Dashboard } from './pages/Dashboard.jsx';
import { Devices } from './pages/Devices.jsx';
import { NotFound } from './pages/NotFound.jsx';
import { PondDetail } from './pages/PondDetail.jsx';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="ponds/:pondId" element={<PondDetail />} />
        <Route path="devices" element={<Devices />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
