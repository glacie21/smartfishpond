/**
 * Titik masuk backend.
 *
 * Menyalakan tiga hal sekaligus di atas satu proses:
 *   1. HTTP server (Express)  — REST API untuk dashboard
 *   2. Socket.IO              — push realtime ke dashboard
 *   3. MQTT subscriber        — menerima telemetri dari device
 */
import { createServer } from 'node:http';

import { createApp } from './app.js';
import { config } from './config/index.js';
import { closePool } from './db/pool.js';
import { closeMqtt, connectMqtt } from './mqtt/client.js';
import { closeSocket, initSocket } from './realtime/socket.js';
import { startMaintenanceJobs } from './services/maintenanceService.js';
import { createLogger } from './utils/logger.js';

const log = createLogger('server');

const app = createApp();
const httpServer = createServer(app);

initSocket(httpServer);
connectMqtt();
const stopMaintenance = startMaintenanceJobs();

httpServer.listen(config.port, () => {
  log.info(`API berjalan di http://localhost:${config.port} (${config.env})`);
});

/** Shutdown rapi: hentikan penerimaan koneksi baru sebelum menutup resource. */
async function shutdown(signal) {
  log.info(`${signal} diterima, mematikan server...`);

  // Paksa keluar bila ada koneksi yang menggantung.
  const forceExit = setTimeout(() => {
    log.error('shutdown melebihi 10 detik, keluar paksa');
    process.exit(1);
  }, 10_000);
  forceExit.unref();

  try {
    stopMaintenance();
    await new Promise((resolve) => httpServer.close(resolve));
    await closeSocket();
    await closeMqtt();
    await closePool();
    log.info('server berhenti dengan bersih');
    process.exit(0);
  } catch (err) {
    log.error(`gagal shutdown: ${err.message}`);
    process.exit(1);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (reason) => {
  log.error('unhandled promise rejection', reason);
});
