import { io } from 'socket.io-client';

import { api } from './client.js';
import { getToken, notifySessionExpired } from './session.js';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? undefined;

let socket = null;

/**
 * Satu koneksi Socket.IO dipakai bersama seluruh aplikasi.
 * Dibuat malas (lazy) supaya tidak menyambung sebelum benar-benar dipakai.
 */
export function getSocket() {
  if (!socket) {
    const instance = io(SOCKET_URL, {
      autoConnect: true,
      reconnectionDelay: 2000,
      transports: ['websocket', 'polling'],
      // Bentuk fungsi: token dibaca ulang setiap (re)connect.
      auth: (cb) => cb({ token: getToken() }),
    });

    // Ditolak middleware auth server -> library tidak mencoba ulang sendiri.
    instance.on('connect_error', (err) => {
      if (!instance.active) notifySessionExpired(err.message);
    });

    // Server memutus koneksi saat token kedaluwarsa. Cek sesi lewat REST:
    // bila masih valid sambung lagi, bila tidak api.me() mengakhiri sesi.
    instance.on('disconnect', (reason) => {
      if (reason !== 'io server disconnect') return;
      api
        .me()
        .then(() => {
          if (socket === instance) instance.connect();
        })
        .catch(() => {});
    });

    socket = instance;
  }
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}
