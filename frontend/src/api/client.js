const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

/**
 * Wrapper fetch: menyusun query string, membaca error dari body JSON,
 * dan mengembalikan field `data` dari respons API.
 */
async function request(path, { params, ...options } = {}) {
  const url = new URL(`${BASE_URL}/api${path}`, window.location.origin);
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, value);
    }
  }

  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  if (response.status === 204) return null;

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(body?.error?.message ?? `Request gagal (${response.status})`);
  }
  return body?.data ?? body;
}

export const api = {
  health: () => request('/health'),

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

  getReadings: (params) => request('/readings', { params }),
  getAggregatedReadings: (params) => request('/readings/aggregate', { params }),
  getLatestReading: (deviceId) => request(`/readings/latest/${deviceId}`),
};
