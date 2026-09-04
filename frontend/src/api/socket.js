import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? undefined;

let socket = null;

/**
 * Satu koneksi Socket.IO dipakai bersama seluruh aplikasi.
 * Dibuat malas (lazy) supaya tidak menyambung sebelum benar-benar dipakai.
 */
export function getSocket() {
  if (!socket) {
    socket = io(SOCKET_URL, {
      autoConnect: true,
      reconnectionDelay: 2000,
      transports: ['websocket', 'polling'],
    });
  }
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}
