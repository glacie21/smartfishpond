import { useEffect, useRef, useState } from 'react';

import { getSocket } from '../api/socket.js';

/**
 * Bergabung ke room beberapa kolam dan memasang handler event Socket.IO.
 * Room di-join ulang setiap (re)connect. Handler dibaca lewat ref sehingga
 * versi terbarunya selalu dipakai tanpa memasang ulang listener; himpunan
 * nama event-nya dianggap tetap.
 *
 * @param pondIds  daftar id kolam
 * @param handlers { [namaEvent]: (payload) => void }
 * @returns apakah socket sedang terhubung
 */
export function usePondRooms(pondIds, handlers) {
  const [connected, setConnected] = useState(false);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;
  const roomKey = pondIds.join('\n');

  useEffect(() => {
    const ids = roomKey ? roomKey.split('\n') : [];
    const socket = getSocket();
    const join = () => {
      setConnected(true);
      for (const id of ids) socket.emit('subscribe:pond', id);
    };
    const drop = () => setConnected(false);
    const listeners = Object.keys(handlersRef.current).map((event) => [
      event,
      (payload) => handlersRef.current[event]?.(payload),
    ]);

    socket.on('connect', join);
    socket.on('disconnect', drop);
    for (const [event, fn] of listeners) socket.on(event, fn);
    if (socket.connected) join();

    return () => {
      for (const id of ids) socket.emit('unsubscribe:pond', id);
      socket.off('connect', join);
      socket.off('disconnect', drop);
      for (const [event, fn] of listeners) socket.off(event, fn);
    };
  }, [roomKey]);

  return connected;
}

/**
 * Event realtime satu kolam:
 *   - latestReading : pembacaan terakhir yang diterima
 *   - devicePatches : { [deviceId]: perubahan status/aktuator } untuk
 *                     digabungkan ke daftar device hasil REST
 *   - commands      : { [commandId]: status perintah aktuator terbaru }
 */
export function usePondRealtime(pondId) {
  const [latestReading, setLatestReading] = useState(null);
  const [devicePatches, setDevicePatches] = useState({});
  const [commands, setCommands] = useState({});

  // Ganti kolam: buang sisa event kolam sebelumnya.
  useEffect(() => {
    setLatestReading(null);
    setDevicePatches({});
    setCommands({});
  }, [pondId]);

  const patchDevice = (patch) =>
    setDevicePatches((all) => ({ ...all, [patch.id]: { ...all[patch.id], ...patch } }));

  const connected = usePondRooms(pondId ? [pondId] : [], {
    'reading:new': (reading) => reading.pond_id === pondId && setLatestReading(reading),
    'device:status': patchDevice,
    'device:actuators': patchDevice,
    'command:updated': (command) => setCommands((all) => ({ ...all, [command.id]: command })),
  });

  return { connected, latestReading, devicePatches, commands };
}
