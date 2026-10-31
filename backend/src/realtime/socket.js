import { Server } from 'socket.io';

import { config } from '../config/index.js';
import { verifyToken } from '../services/authService.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('socket');

const MAX_TIMEOUT_MS = 2 ** 31 - 1;

/** @type {Server | null} */
let io = null;

/**
 * Memasang Socket.IO pada HTTP server yang sama dengan Express.
 *
 * Klien bergabung ke "room" per kolam/device agar dashboard hanya menerima
 * event yang relevan, bukan seluruh trafik semua kolam.
 */
export function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: { origin: config.cors.origin, methods: ['GET', 'POST'] },
  });

  // Handshake wajib membawa JWT yang sama dengan REST API:
  // io(url, { auth: { token } }).
  io.use((socket, next) => {
    try {
      socket.data.user = verifyToken(socket.handshake.auth?.token);
      next();
    } catch (err) {
      next(new Error(err.message));
    }
  });

  io.on('connection', (socket) => {
    const { username, exp } = socket.data.user;
    log.debug(`klien terhubung: ${socket.id} (${username})`);

    // Putuskan koneksi tepat saat token kedaluwarsa; klien harus login ulang.
    // Dibatasi MAX_TIMEOUT_MS karena setTimeout meluap di atas ~24,8 hari.
    const expiryTimer = setTimeout(
      () => socket.disconnect(true),
      Math.min(Math.max(exp * 1000 - Date.now(), 0), MAX_TIMEOUT_MS),
    );
    socket.on('disconnect', () => clearTimeout(expiryTimer));

    socket.on('subscribe:pond', (pondId) => {
      if (typeof pondId !== 'string' || !pondId) return;
      socket.join(`pond:${pondId}`);
      log.debug(`${socket.id} subscribe pond:${pondId}`);
    });

    socket.on('unsubscribe:pond', (pondId) => {
      if (typeof pondId !== 'string' || !pondId) return;
      socket.leave(`pond:${pondId}`);
    });

    socket.on('subscribe:device', (deviceId) => {
      if (typeof deviceId !== 'string' || !deviceId) return;
      socket.join(`device:${deviceId}`);
    });

    socket.on('disconnect', (reason) => {
      log.debug(`klien terputus: ${socket.id} (${reason})`);
    });
  });

  log.info('Socket.IO siap');
  return io;
}

/**
 * Menyiarkan event ke room kolam dan device terkait.
 * Aman dipanggil sebelum initSocket (mis. pada unit test) — akan diabaikan.
 */
export function broadcast(event, payload, { pondId, deviceId } = {}) {
  if (!io) return;
  if (pondId) io.to(`pond:${pondId}`).emit(event, payload);
  if (deviceId) io.to(`device:${deviceId}`).emit(event, payload);
}

export function getIo() {
  return io;
}

export async function closeSocket() {
  if (!io) return;
  await io.close();
  io = null;
  log.info('Socket.IO ditutup');
}
