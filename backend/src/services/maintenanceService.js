import { config } from '../config/index.js';
import * as deviceRepository from '../repositories/deviceRepository.js';
import * as readingRepository from '../repositories/readingRepository.js';
import { broadcast } from '../realtime/socket.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('maintenance');

const STALE_THRESHOLD_SECONDS = 180; // 3x interval publish default (30 detik)
const STALE_CHECK_INTERVAL_MS = 60_000;
const RETENTION_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 jam

/**
 * Menandai offline device yang lama tak mengirim data.
 * Diperlukan karena Last Will MQTT bisa hilang saat broker restart.
 */
async function sweepStaleDevices() {
  try {
    const staleIds = await deviceRepository.markStaleOffline(STALE_THRESHOLD_SECONDS);
    for (const id of staleIds) {
      log.warn(`${id} tidak mengirim data > ${STALE_THRESHOLD_SECONDS} detik, ditandai offline`);
      broadcast('device:status', { id, status: 'offline' }, { deviceId: id });
    }
  } catch (err) {
    log.error('gagal memeriksa device stale', err.message);
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
  const staleTimer = setInterval(sweepStaleDevices, STALE_CHECK_INTERVAL_MS);
  const retentionTimer = setInterval(pruneOldReadings, RETENTION_INTERVAL_MS);

  // Timer tidak boleh menahan proses tetap hidup saat shutdown.
  staleTimer.unref();
  retentionTimer.unref();
  log.info('tugas latar berjalan (pemeriksaan device stale + retensi data)');

  return () => {
    clearInterval(staleTimer);
    clearInterval(retentionTimer);
  };
}
