import { Server } from 'socket.io';

import { config } from '../config/index.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('socket');

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

  io.on('connection', (socket) => {
    log.debug(`klien terhubung: ${socket.id}`);

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
