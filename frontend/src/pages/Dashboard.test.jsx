import { act, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Dashboard } from './Dashboard.jsx';

vi.mock('../api/client.js', () => ({ api: { listPonds: vi.fn() } }));
vi.mock('../context/AuthContext.jsx', () => ({ useAuth: () => ({ user: { role: 'viewer' } }) }));

/** Socket palsu: menyimpan handler agar test bisa memicu event. */
const handlers = {};
const fakeSocket = {
  connected: true,
  emit: vi.fn(),
  on: (event, fn) => (handlers[event] = fn),
  off: (event) => delete handlers[event],
};
vi.mock('../api/socket.js', () => ({ getSocket: () => fakeSocket }));

const { api } = await import('../api/client.js');

const recent = () => new Date(Date.now() - 60_000).toISOString();
const ponds = () => [
  {
    id: 'pond-01',
    name: 'Kolam A',
    location: 'Blok utara',
    fish_type: 'Nila',
    device_count: 1,
    device_online: 1,
    latest_reading: { recorded_at: recent(), temperature: 28.4, ph: 7.1, dissolved_oxygen: 3.2 },
  },
  { id: 'pond-02', name: 'Kolam B', device_count: 0, device_online: 0, latest_reading: null },
];
const doAlert = {
  id: 7,
  pond_id: 'pond-01',
  pond_name: 'Kolam A',
  metric: 'dissolved_oxygen',
  severity: 'critical',
  message: 'Oksigen terlarut 3.2 mg/L di bawah batas aman',
};

function renderDashboard(alerts = []) {
  return render(
    <MemoryRouter>
      <Routes>
        <Route element={<Outlet context={{ alerts }} />}>
          <Route index element={<Dashboard />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

const card = (name) => screen.getByRole('heading', { name }).closest('a');

beforeEach(() => {
  vi.clearAllMocks();
  api.listPonds.mockResolvedValue(ponds());
});

describe('Dashboard', () => {
  it('menampilkan kartu kolam dengan nilai sensor terbaru', async () => {
    renderDashboard();
    expect(await screen.findByRole('heading', { name: 'Kolam A' })).toBeInTheDocument();

    expect(card('Kolam A')).toHaveAttribute('href', '/ponds/pond-01');
    expect(within(card('Kolam A')).getByText('28.4')).toBeInTheDocument();
    expect(within(card('Kolam A')).getByText('Normal')).toBeInTheDocument();
    expect(within(card('Kolam B')).getByText('Belum ada data')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Semua kolam dalam kondisi aman' })).toBeInTheDocument();
  });

  it('status kolam mengikuti alert terbuka dari backend', async () => {
    renderDashboard([doAlert]);
    await screen.findByRole('heading', { name: 'Kolam A' });

    expect(within(card('Kolam A')).getByText('Kritis')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '1 alert perlu perhatian' })).toBeInTheDocument();
    expect(screen.getByText(/di bawah batas aman/)).toBeInTheDocument();
  });

  it('bergabung ke room tiap kolam dan memperbarui kartu dari event realtime', async () => {
    renderDashboard();
    await screen.findByRole('heading', { name: 'Kolam A' });
    expect(fakeSocket.emit).toHaveBeenCalledWith('subscribe:pond', 'pond-01');
    expect(fakeSocket.emit).toHaveBeenCalledWith('subscribe:pond', 'pond-02');

    act(() => handlers['reading:new']({ pond_id: 'pond-01', recorded_at: new Date().toISOString(), temperature: 30.2 }));
    expect(within(card('Kolam A')).getByText('30.2')).toBeInTheDocument();
  });
});
