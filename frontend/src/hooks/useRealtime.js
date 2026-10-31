import { useEffect, useState } from 'react';

import { getSocket } from '../api/socket.js';

/**
 * Berlangganan event realtime untuk satu kolam.
 *
 * Mengembalikan:
 *   - latestReading : pembacaan terakhir yang diterima
 *   - devicePatches : { [deviceId]: perubahan status/aktuator } untuk
 *                     digabungkan ke daftar device hasil REST
 *   - commands      : { [commandId]: status perintah aktuator terbaru }
 * Komponen pemanggil memakai nilai ini untuk memperbarui UI tanpa polling.
 */
export function usePondRealtime(pondId) {
  const [connected, setConnected] = useState(false);
  const [latestReading, setLatestReading] = useState(null);
  const [devicePatches, setDevicePatches] = useState({});
  const [commands, setCommands] = useState({});

  useEffect(() => {
    if (!pondId) return undefined;

    setDevicePatches({});
    setCommands({});
    const socket = getSocket();

    const patchDevice = (patch) =>
      setDevicePatches((all) => ({ ...all, [patch.id]: { ...all[patch.id], ...patch } }));

    const onConnect = () => {
      setConnected(true);
      // Room di-join ulang setiap connect, termasuk setelah reconnect.
      socket.emit('subscribe:pond', pondId);
    };
    const onDisconnect = () => setConnected(false);
    const onReading = (reading) => setLatestReading(reading);
    const onCommand = (command) => setCommands((all) => ({ ...all, [command.id]: command }));

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('reading:new', onReading);
    socket.on('device:status', patchDevice);
    socket.on('device:actuators', patchDevice);
    socket.on('command:updated', onCommand);

    if (socket.connected) onConnect();

    return () => {
      socket.emit('unsubscribe:pond', pondId);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('reading:new', onReading);
      socket.off('device:status', patchDevice);
      socket.off('device:actuators', patchDevice);
      socket.off('command:updated', onCommand);
    };
  }, [pondId]);

  return { connected, latestReading, devicePatches, commands };
}
