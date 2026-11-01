import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RequireAuth } from '../components/RequireAuth.jsx';
import { AuthProvider } from '../context/AuthContext.jsx';
import { Login } from './Login.jsx';

vi.mock('../api/client.js', () => ({
  api: { login: vi.fn(), me: vi.fn() },
}));
vi.mock('../api/socket.js', () => ({ disconnectSocket: vi.fn(), getSocket: vi.fn() }));

const { api } = await import('../api/client.js');

/** Aplikasi mini: /login publik, /devices butuh login. */
function renderApp(initialPath) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<RequireAuth />}>
            <Route path="/devices" element={<h1>Halaman perangkat</h1>} />
            <Route path="/" element={<h1>Dashboard</h1>} />
          </Route>
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

async function fillAndSubmit(username, password) {
  await userEvent.type(screen.getByLabelText('Username'), username);
  await userEvent.type(screen.getByLabelText('Password'), password);
  await userEvent.click(screen.getByRole('button', { name: 'Masuk' }));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('login & proteksi halaman', () => {
  it('tamu yang membuka halaman terproteksi diarahkan ke login', () => {
    renderApp('/devices');
    expect(screen.getByRole('button', { name: 'Masuk' })).toBeInTheDocument();
  });

  it('setelah login kembali ke halaman yang tadi dibuka dan token disimpan', async () => {
    api.login.mockResolvedValue({ token: 'jwt-123', user: { id: '1', username: 'admin', role: 'admin' } });
    renderApp('/devices');

    await fillAndSubmit('admin', 'rahasia-admin');

    expect(await screen.findByRole('heading', { name: 'Halaman perangkat' })).toBeInTheDocument();
    expect(api.login).toHaveBeenCalledWith('admin', 'rahasia-admin');
    expect(localStorage.getItem('fishpond.token')).toBe('jwt-123');
  });

  it('password salah menampilkan pesan dan mengosongkan password', async () => {
    api.login.mockRejectedValue(new Error('Username atau password salah'));
    renderApp('/login');

    await fillAndSubmit('admin', 'salah');

    expect(await screen.findByRole('alert')).toHaveTextContent('Username atau password salah');
    expect(screen.getByLabelText('Password')).toHaveValue('');
  });

  it('token tersimpan yang masih valid langsung masuk tanpa login ulang', async () => {
    localStorage.setItem('fishpond.token', 'jwt-lama');
    api.me.mockResolvedValue({ id: '1', username: 'admin', role: 'admin' });
    renderApp('/');

    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
  });

  it('token tersimpan yang sudah tidak berlaku kembali ke login', async () => {
    localStorage.setItem('fishpond.token', 'jwt-basi');
    api.me.mockRejectedValue(new Error('Sesi berakhir'));
    renderApp('/');

    expect(await screen.findByRole('button', { name: 'Masuk' })).toBeInTheDocument();
  });
});
