import { ingestStatus, ingestTelemetry } from '../services/telemetryService.js';
import { createLogger } from '../utils/logger.js';
import { parseTopic } from './topics.js';

const log = createLogger('mqtt');

/**
 * Router pesan MQTT: mengurai topik, mem-parse JSON, lalu meneruskan
 * ke service yang sesuai.
 *
 * Semua error ditangkap di sini — satu paket rusak tidak boleh
 * menjatuhkan koneksi MQTT atau proses backend.
 */
export async function handleMessage(topic, buffer) {
  const parts = parseTopic(topic);
  if (!parts) {
    log.warn(`topik tidak dikenali: ${topic}`);
    return;
  }

  let payload;
  try {
    payload = JSON.parse(buffer.toString());
  } catch {
    log.warn(`payload bukan JSON valid pada ${topic}: ${buffer.toString().slice(0, 120)}`);
    return;
  }

  try {
    switch (parts.kind) {
      case 'telemetry':
        await ingestTelemetry({
          ...payload,
          // Topik adalah sumber kebenaran bila payload tidak konsisten.
          deviceId: payload.deviceId ?? parts.deviceId,
          pondId: payload.pondId ?? parts.pondId,
        });
        log.debug(`telemetri tersimpan dari ${parts.deviceId}`);
        break;

      case 'status':
        await ingestStatus(payload, { deviceId: parts.deviceId, pondId: parts.pondId });
        break;

      default:
        log.debug(`jenis topik "${parts.kind}" diabaikan`);
    }
  } catch (err) {
    log.error(`gagal memproses ${topic}: ${err.message}`, err.details ?? undefined);
  }
}
