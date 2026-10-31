import { useCallback, useEffect, useRef, useState } from 'react';

import { api } from '../api/client.js';
import { getSocket } from '../api/socket.js';

/** Alert terbuka di atas, lalu yang terbaru lebih dulu. */
function compareAlerts(a, b) {
  const openA = a.resolved_at ? 1 : 0;
  const openB = b.resolved_at ? 1 : 0;
  if (openA !== openB) return openA - openB;
  return new Date(b.started_at) - new Date(a.started_at);
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
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    setError(null);
    try {
      const list = await api.listAlerts({ status, pondId, limit });
      if (mountedRef.current) setAlerts(list);
    } catch (err) {
      if (mountedRef.current) setError(err.message);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [status, pondId, limit]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  useEffect(() => {
    const socket = getSocket();

    const upsert = (alert) => {
      if (pondId && alert.pond_id !== pondId) return;
      setAlerts((list) => {
        const others = list.filter((a) => a.id !== alert.id);
        if (!matchesStatus(alert, status)) return others;
        return [alert, ...others].sort(compareAlerts);
      });
    };

    socket.on('alert:updated', upsert);
    socket.on('alert:resolved', upsert);
    // Event yang terlewat selama koneksi putus diambil ulang lewat REST.
    socket.io.on('reconnect', load);

    return () => {
      socket.off('alert:updated', upsert);
      socket.off('alert:resolved', upsert);
      socket.io.off('reconnect', load);
    };
  }, [status, pondId, load]);

  /** Menandai alert sudah ditangani; daftar ikut diperbarui. */
  const acknowledge = useCallback(async (id) => {
    const updated = await api.acknowledgeAlert(id);
    setAlerts((list) => list.map((a) => (a.id === id ? updated : a)));
    return updated;
  }, []);

  return { alerts, loading, error, reload: load, acknowledge };
}
