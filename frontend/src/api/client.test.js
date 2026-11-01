import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { api } from './client.js';
import { onSessionExpired, setToken } from './session.js';

function mockFetch(status, body) {
  const fetchMock = vi.fn(async () => ({
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
  }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('api client', () => {
  it('menyisipkan token login di header Authorization', async () => {
    setToken('token-abc');
    const fetchMock = mockFetch(200, { data: [] });

    await api.listPonds();

    const [, options] = fetchMock.mock.calls[0];
    expect(options.headers.Authorization).toBe('Bearer token-abc');
  });

  it('tidak mengirim token lama saat login', async () => {
    setToken('token-lama');
    const fetchMock = mockFetch(200, { data: { token: 'baru', user: {} } });

    await api.login('admin', 'rahasia');

    const [, options] = fetchMock.mock.calls[0];
    expect(options.headers.Authorization).toBeUndefined();
    expect(JSON.parse(options.body)).toEqual({ username: 'admin', password: 'rahasia' });
  });

  it('mengembalikan isi field data', async () => {
    mockFetch(200, { data: [{ id: 'pond-01' }] });
    await expect(api.listPonds()).resolves.toEqual([{ id: 'pond-01' }]);
  });

  it('menyusun query string dan membuang parameter kosong', async () => {
    const fetchMock = mockFetch(200, { data: [] });
    await api.listAlerts({ status: 'open', pondId: undefined, limit: 50 });

    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.pathname).toBe('/api/alerts');
    expect(url.searchParams.get('status')).toBe('open');
    expect(url.searchParams.get('limit')).toBe('50');
    expect(url.searchParams.has('pondId')).toBe(false);
  });

  it('401 mengakhiri sesi dan menghapus token', async () => {
    setToken('kedaluwarsa');
    mockFetch(401, { error: { message: 'Sesi berakhir, silakan login ulang' } });
    const listener = vi.fn();
    const unsubscribe = onSessionExpired(listener);

    await expect(api.listPonds()).rejects.toThrow('Sesi berakhir');
    expect(listener).toHaveBeenCalledWith('Sesi berakhir, silakan login ulang');
    expect(localStorage.getItem('fishpond.token')).toBeNull();
    unsubscribe();
  });

  it('401 saat login hanya menampilkan pesan, bukan "sesi berakhir"', async () => {
    mockFetch(401, { error: { message: 'Username atau password salah' } });
    const listener = vi.fn();
    const unsubscribe = onSessionExpired(listener);

    await expect(api.login('admin', 'salah')).rejects.toThrow('Username atau password salah');
    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });

  it('204 tanpa body mengembalikan null', async () => {
    mockFetch(204, null);
    await expect(api.deleteDevice('esp32-node-01')).resolves.toBeNull();
  });
});
