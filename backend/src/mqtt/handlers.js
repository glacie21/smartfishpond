import { ingestActuatorState, ingestCommandAck } from '../services/deviceControlService.js';
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

  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    log.warn(`payload pada ${topic} bukan objek JSON`);
    return;
  }

  // Topik adalah sumber kebenaran identitas: ACL broker membatasi tiap device
  // hanya boleh publish ke topik dengan deviceId miliknya sendiri. Payload yang
  // mengaku sebagai device/kolam lain ditolak agar ACL itu tidak bisa diakali.
  if (
    (payload.deviceId !== undefined && payload.deviceId !== parts.deviceId) ||
    (payload.pondId !== undefined && payload.pondId !== parts.pondId)
  ) {
    log.warn(
      `identitas payload (${payload.pondId}/${payload.deviceId}) tidak cocok dengan topik ${topic}, paket ditolak`,
    );
    return;
  }
  const identified = { ...payload, deviceId: parts.deviceId, pondId: parts.pondId };

  try {
    switch (parts.kind) {
      case 'telemetry':
        await ingestTelemetry(identified);
        log.debug(`telemetri tersimpan dari ${parts.deviceId}`);
        break;

      case 'status':
        await ingestStatus(identified, { deviceId: parts.deviceId, pondId: parts.pondId });
        break;

      case 'actuators':
        await ingestActuatorState(identified, { deviceId: parts.deviceId, pondId: parts.pondId });
        break;

      case 'ack':
        await ingestCommandAck(identified, { deviceId: parts.deviceId, pondId: parts.pondId });
        break;

      default:
        log.debug(`jenis topik "${parts.kind}" diabaikan`);
    }
  } catch (err) {
    log.error(`gagal memproses ${topic}: ${err.message}`, err.details ?? undefined);
  }
}
