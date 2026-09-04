import * as deviceRepository from '../repositories/deviceRepository.js';
import * as pondRepository from '../repositories/pondRepository.js';
import * as readingRepository from '../repositories/readingRepository.js';
import { badRequest } from '../utils/errors.js';
import { createLogger } from '../utils/logger.js';
import { broadcast } from '../realtime/socket.js';
import {
  PLAUSIBLE_RANGE,
  statusPayloadSchema,
  telemetryPayloadSchema,
} from './telemetrySchema.js';

const log = createLogger('telemetry');

/**
 * Membuang nilai di luar rentang wajar (jadi null) agar satu sensor rusak
 * tidak merusak grafik. Pembacaan lain pada paket yang sama tetap disimpan.
 */
function sanitizeMetrics(metrics, deviceId) {
  const clean = {};
  for (const [key, range] of Object.entries(PLAUSIBLE_RANGE)) {
    const value = metrics[key];
    if (value === undefined || value === null) {
      clean[key] = null;
      continue;
    }
    const [min, max] = range;
    if (value < min || value > max) {
      log.warn(`${deviceId}: ${key}=${value} di luar rentang [${min}, ${max}], diabaikan`);
      clean[key] = null;
      continue;
    }
    clean[key] = value;
  }
  return clean;
}

/**
 * Memproses satu paket telemetri: validasi -> auto-provision kolam & device
 * -> simpan -> siarkan ke dashboard.
 *
 * @param raw payload hasil JSON.parse
 * @returns baris reading yang tersimpan
 */
export async function ingestTelemetry(raw) {
  const parsed = telemetryPayloadSchema.safeParse(raw);
  if (!parsed.success) {
    throw badRequest('Payload telemetri tidak valid', parsed.error.flatten());
  }

  const { deviceId, pondId, timestamp, rssi, uptime, metrics } = parsed.data;
  const clean = sanitizeMetrics(metrics, deviceId);

  // Urutannya penting: kolam dulu, lalu device (foreign key).
  await pondRepository.ensureExists(pondId);
  await deviceRepository.ensureExists(deviceId, pondId);

  const reading = await readingRepository.insert({
    deviceId,
    pondId,
    recordedAt: timestamp ?? null,
    rssi: rssi ?? null,
    ...clean,
  });

  await deviceRepository.updateStatus(deviceId, {
    status: 'online',
    rssi: rssi ?? null,
    uptimeS: uptime ?? null,
  });

  broadcast('reading:new', reading, { pondId, deviceId });
  return reading;
}

/** Memproses pesan status/Last Will dari device. */
export async function ingestStatus(raw, { deviceId, pondId }) {
  const parsed = statusPayloadSchema.safeParse(raw);
  if (!parsed.success) {
    throw badRequest('Payload status tidak valid', parsed.error.flatten());
  }

  const resolvedPondId = parsed.data.pondId ?? pondId;
  const resolvedDeviceId = parsed.data.deviceId ?? deviceId;
  if (!resolvedDeviceId || !resolvedPondId) {
    throw badRequest('deviceId/pondId tidak dapat ditentukan dari topik maupun payload');
  }

  await pondRepository.ensureExists(resolvedPondId);
  await deviceRepository.ensureExists(resolvedDeviceId, resolvedPondId);

  const device = await deviceRepository.updateStatus(resolvedDeviceId, {
    status: parsed.data.status,
    ipAddress: parsed.data.ip ?? null,
    rssi: parsed.data.rssi ?? null,
    uptimeS: parsed.data.uptime ?? null,
  });

  log.info(`${resolvedDeviceId} -> ${parsed.data.status}`);
  broadcast('device:status', device, { pondId: resolvedPondId, deviceId: resolvedDeviceId });
  return device;
}
