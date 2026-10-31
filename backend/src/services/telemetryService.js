import * as deviceRepository from '../repositories/deviceRepository.js';
import * as readingRepository from '../repositories/readingRepository.js';
import { badRequest } from '../utils/errors.js';
import { createLogger } from '../utils/logger.js';
import { broadcast } from '../realtime/socket.js';
import * as alertService from './alertService.js';
import { resolveReportingDevice as resolveDevice } from './deviceService.js';
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
 * -> simpan -> siarkan ke dashboard -> evaluasi ambang batas (alert).
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

  await resolveDevice(deviceId, pondId);

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

  // Data sudah aman tersimpan; kegagalan alert tidak boleh membatalkannya.
  try {
    await alertService.evaluateReading(reading);
  } catch (err) {
    log.error(`evaluasi alert gagal untuk ${deviceId}: ${err.message}`);
  }
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

  await resolveDevice(resolvedDeviceId, resolvedPondId);

  const device = await deviceRepository.updateStatus(resolvedDeviceId, {
    status: parsed.data.status,
    ipAddress: parsed.data.ip ?? null,
    rssi: parsed.data.rssi ?? null,
    uptimeS: parsed.data.uptime ?? null,
  });

  log.info(`${resolvedDeviceId} -> ${parsed.data.status}`);
  broadcast('device:status', device, { pondId: resolvedPondId, deviceId: resolvedDeviceId });

  if (parsed.data.status === 'online') {
    try {
      await alertService.resolveDeviceOffline(resolvedDeviceId);
    } catch (err) {
      log.error(`gagal menutup alert offline ${resolvedDeviceId}: ${err.message}`);
    }
  }
  return device;
}
