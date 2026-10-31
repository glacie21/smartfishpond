import { getToken, notifySessionExpired } from './session.js';

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

/**
 * Wrapper fetch: menyusun query string, menyisipkan token login, membaca
 * error dari body JSON, dan mengembalikan field `data` dari respons API.
 *
 * Respons 401 di luar endpoint login berarti token tidak berlaku lagi,
 * sehingga sesi diakhiri dan pengguna diarahkan ke halaman login.
 */
async function request(path, { params, isLogin = false, ...options } = {}) {
  const url = new URL(`${BASE_URL}/api${path}`, window.location.origin);
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, value);
    }
  }

  const token = getToken();
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && !isLogin ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (response.status === 204) return null;

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const message = body?.error?.message ?? `Request gagal (${response.status})`;
    if (response.status === 401 && !isLogin) notifySessionExpired(message);
    throw new Error(message);
  }
  return body?.data ?? body;
}

export const api = {
  health: () => request('/health'),

  login: (username, password) =>
    request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
      isLogin: true,
    }),
  me: () => request('/auth/me'),

  listPonds: () => request('/ponds'),
  getPond: (id) => request(`/ponds/${id}`),
  getPondOverview: (id) => request(`/ponds/${id}/overview`),
  getPondSummary: (id, params) => request(`/ponds/${id}/summary`, { params }),
  createPond: (payload) =>
    request('/ponds', { method: 'POST', body: JSON.stringify(payload) }),
  updatePond: (id, payload) =>
    request(`/ponds/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  deletePond: (id) => request(`/ponds/${id}`, { method: 'DELETE' }),

  listDevices: (params) => request('/devices', { params }),
  getDevice: (id) => request(`/devices/${id}`),
  createDevice: (payload) =>
    request('/devices', { method: 'POST', body: JSON.stringify(payload) }),
  updateDevice: (id, payload) =>
    request(`/devices/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  deleteDevice: (id) => request(`/devices/${id}`, { method: 'DELETE' }),
  sendCommand: (id, payload) =>
    request(`/devices/${id}/commands`, { method: 'POST', body: JSON.stringify(payload) }),
  listCommands: (id, params) => request(`/devices/${id}/commands`, { params }),

  getReadings: (params) => request('/readings', { params }),
  getAggregatedReadings: (params) => request('/readings/aggregate', { params }),
  getLatestReading: (deviceId) => request(`/readings/latest/${deviceId}`),

  listAlerts: (params) => request('/alerts', { params }),
  acknowledgeAlert: (id) => request(`/alerts/${id}/acknowledge`, { method: 'POST' }),

  getThresholds: (pondId) => request('/thresholds', { params: { pondId } }),
  setThreshold: (metric, payload) =>
    request(`/thresholds/${metric}`, { method: 'PUT', body: JSON.stringify(payload) }),
  resetThreshold: (metric, pondId) =>
    request(`/thresholds/${metric}`, { method: 'DELETE', params: { pondId } }),
};
