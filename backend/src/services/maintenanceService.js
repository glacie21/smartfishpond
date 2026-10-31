import { config } from '../config/index.js';
import * as deviceRepository from '../repositories/deviceRepository.js';
import * as readingRepository from '../repositories/readingRepository.js';
import { broadcast } from '../realtime/socket.js';
import { createLogger } from '../utils/logger.js';
import * as alertService from './alertService.js';
import * as deviceControlService from './deviceControlService.js';

const log = createLogger('maintenance');

const STALE_THRESHOLD_SECONDS = 180; // 3x interval publish default (30 detik)
const STALE_CHECK_INTERVAL_MS = 60_000;
const COMMAND_CHECK_INTERVAL_MS = 10_000;
const RETENTION_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 jam

/**
 * Menandai offline device yang lama tak mengirim data.
 * Diperlukan karena Last Will MQTT bisa hilang saat broker restart.
 */
async function sweepStaleDevices() {
  try {
    const stale = await deviceRepository.markStaleOffline(STALE_THRESHOLD_SECONDS);
    for (const { id, pond_id: pondId } of stale) {
      log.warn(`${id} tidak mengirim data > ${STALE_THRESHOLD_SECONDS} detik, ditandai offline`);
      broadcast('device:status', { id, status: 'offline' }, { pondId, deviceId: id });
    }
  } catch (err) {
    log.error('gagal memeriksa device stale', err.message);
  }
}

/** Stale check lalu alert offline — berurutan agar status offline sudah terbaru. */
async function runDeviceChecks() {
  await sweepStaleDevices();
  try {
    await alertService.openOfflineAlerts();
  } catch (err) {
    log.error('gagal memeriksa alert device offline', err.message);
  }
}

/** Perintah aktuator tanpa balasan -> timeout. Dicek sering agar UI cepat tahu. */
async function sweepPendingCommands() {
  try {
    await deviceControlService.expirePendingCommands();
  } catch (err) {
    log.error('gagal memeriksa perintah tanpa balasan', err.message);
  }
}

/** Menghapus data mentah melewati masa retensi. */
async function pruneOldReadings() {
  if (config.retention.rawDays <= 0) return;
  try {
    const deleted = await readingRepository.deleteOlderThan(config.retention.rawDays);
    if (deleted > 0) {
      log.info(`${deleted} baris readings > ${config.retention.rawDays} hari dihapus`);
    }
  } catch (err) {
    log.error('gagal menghapus data lama', err.message);
  }
}

/** Menjadwalkan tugas latar; mengembalikan fungsi untuk menghentikannya. */
export function startMaintenanceJobs() {
  const timers = [
    setInterval(runDeviceChecks, STALE_CHECK_INTERVAL_MS),
    setInterval(sweepPendingCommands, COMMAND_CHECK_INTERVAL_MS),
    setInterval(pruneOldReadings, RETENTION_INTERVAL_MS),
  ];

  // Timer tidak boleh menahan proses tetap hidup saat shutdown.
  for (const timer of timers) timer.unref();
  log.info('tugas latar berjalan (device stale, alert offline, timeout perintah, retensi data)');

  return () => {
    for (const timer of timers) clearInterval(timer);
  };
}
