import { useEffect, useState } from 'react';

import { getSocket } from '../api/socket.js';

/**
 * Berlangganan event realtime untuk satu kolam.
 *
 * Mengembalikan pembacaan terakhir yang diterima lewat WebSocket dan
 * status koneksi socket-nya. Komponen pemanggil memakai nilai ini untuk
 * memperbarui kartu tanpa polling.
 */
export function usePondRealtime(pondId) {
  const [connected, setConnected] = useState(false);
  const [latestReading, setLatestReading] = useState(null);
  const [deviceStatus, setDeviceStatus] = useState(null);

  useEffect(() => {
    if (!pondId) return undefined;

    const socket = getSocket();

    const onConnect = () => {
      setConnected(true);
      // Room di-join ulang setiap connect, termasuk setelah reconnect.
      socket.emit('subscribe:pond', pondId);
    };
    const onDisconnect = () => setConnected(false);
    const onReading = (reading) => setLatestReading(reading);
    const onStatus = (device) => setDeviceStatus(device);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('reading:new', onReading);
    socket.on('device:status', onStatus);

    if (socket.connected) onConnect();

    return () => {
      socket.emit('unsubscribe:pond', pondId);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('reading:new', onReading);
      socket.off('device:status', onStatus);
    };
  }, [pondId]);

  return { connected, latestReading, deviceStatus };
}
