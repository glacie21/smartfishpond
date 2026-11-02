import { useCallback, useEffect } from 'react';

import { api } from '../api/client.js';
import { getSocket } from '../api/socket.js';
import { useApi } from './useApi.js';

/** Alert terbuka di atas, lalu yang terbaru lebih dulu. */
function compareAlerts(a, b) {
  const open = Number(Boolean(a.resolved_at)) - Number(Boolean(b.resolved_at));
  return open || new Date(b.started_at) - new Date(a.started_at);
}

function matchesStatus(alert, status) {
  if (status === 'open') return !alert.resolved_at;
  if (status === 'resolved') return Boolean(alert.resolved_at);
  return true;
}

/**
 * Daftar alert yang selalu mutakhir: dimuat dari REST, lalu diperbarui
 * oleh event Socket.IO `alert:updated` / `alert:resolved` tanpa polling.
 *
 * @param status 'open' | 'resolved' | 'all'
 * @param pondId opsional, hanya alert kolam ini
 */
export function useAlertFeed({ status = 'open', pondId, limit = 200 } = {}) {
  const { data, loading, error, refetch, setData } = useApi(
    () => api.listAlerts({ status, pondId, limit }),
    [status, pondId, limit],
  );

  useEffect(() => {
    const socket = getSocket();
    const upsert = (alert) => {
      if (pondId && alert.pond_id !== pondId) return;
      setData((list) => {
        const others = (list ?? []).filter((a) => a.id !== alert.id);
        return matchesStatus(alert, status) ? [alert, ...others].sort(compareAlerts) : others;
      });
    };
    // Event yang terlewat selama koneksi putus diambil ulang lewat REST.
    const resync = () => refetch({ silent: true });

    socket.on('alert:updated', upsert);
    socket.on('alert:resolved', upsert);
    socket.io.on('reconnect', resync);
    return () => {
      socket.off('alert:updated', upsert);
      socket.off('alert:resolved', upsert);
      socket.io.off('reconnect', resync);
    };
  }, [status, pondId, refetch, setData]);

  /** Menandai alert sudah ditangani; daftar ikut diperbarui. */
  const acknowledge = useCallback(
    async (id) => {
      const updated = await api.acknowledgeAlert(id);
      setData((list) => list.map((a) => (a.id === id ? updated : a)));
      return updated;
    },
    [setData],
  );

  return { alerts: data ?? [], loading, error, reload: refetch, acknowledge };
}
