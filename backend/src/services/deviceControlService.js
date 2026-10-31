import { z } from 'zod';

import { config } from '../config/index.js';
import { publishJson } from '../mqtt/client.js';
import { buildTopic } from '../mqtt/topics.js';
import { broadcast } from '../realtime/socket.js';
import * as commandRepository from '../repositories/commandRepository.js';
import * as deviceRepository from '../repositories/deviceRepository.js';
import { badRequest, HttpError } from '../utils/errors.js';
import { createLogger } from '../utils/logger.js';
import { getDevice, resolveReportingDevice } from './deviceService.js';

const log = createLogger('control');

/** Aktuator yang dikenal sistem. Firmware melaporkan mana yang terpasang. */
export const ACTUATORS = ['aerator', 'pump', 'feeder'];

/** Batas durasi menyala otomatis: 24 jam. */
export const MAX_DURATION_S = 24 * 60 * 60;

/** Payload `.../actuators` (retained) dari device. Kunci tak dikenal dibuang. */
const actuatorStateSchema = z.object(
  Object.fromEntries(ACTUATORS.map((name) => [name, z.boolean().optional()])),
);

/** Payload `.../ack` dari device sebagai balasan sebuah perintah. */
const ackSchema = z.object({
  id: z.string().uuid(),
  ok: z.boolean(),
  error: z.string().max(200).nullable().optional(),
});

/**
 * Mengirim perintah nyala/mati aktuator ke device lewat MQTT dan mencatatnya.
 * Status awal 'sent'; berubah 'done'/'failed' saat device membalas, atau
 * 'timeout' bila tidak ada balasan.
 */
export async function sendCommand(deviceId, { actuator, state, durationS }, requestedBy) {
  const device = await getDevice(deviceId);
  if (device.status !== 'online') {
    // Device memakai clean session, jadi perintah saat offline akan hilang.
    throw new HttpError(409, `Perangkat "${deviceId}" sedang offline, perintah tidak bisa dikirim`);
  }
  if (durationS && !state) {
    throw badRequest('durationS hanya berlaku untuk perintah menyalakan (state = true)');
  }

  const command = await commandRepository.create({
    deviceId,
    actuator,
    state,
    durationS,
    requestedBy,
  });

  const topic = buildTopic({ base: config.mqtt.base, pondId: device.pond_id, deviceId, kind: 'command' });
  try {
    await publishJson(topic, { id: command.id, actuator, state, durationS: durationS ?? null });
  } catch (err) {
    await commandRepository.markFailed(command.id, err.message);
    throw new HttpError(503, `Perintah gagal dikirim: ${err.message}`);
  }

  log.info(
    `${requestedBy} -> ${deviceId}: ${actuator} ${state ? 'ON' : 'OFF'}` +
      (durationS ? ` selama ${durationS} detik` : ''),
  );
  broadcast('command:updated', command, { pondId: device.pond_id, deviceId });
  return command;
}

export async function listCommands(deviceId, limit) {
  await getDevice(deviceId);
  return commandRepository.findByDevice(deviceId, limit);
}

/** Device melaporkan status relay terkini (topik `.../actuators`). */
export async function ingestActuatorState(raw, { deviceId, pondId }) {
  const parsed = actuatorStateSchema.safeParse(raw);
  if (!parsed.success) {
    throw badRequest('Payload status aktuator tidak valid', parsed.error.flatten());
  }

  // Pesan ini bisa tiba sebelum status/telemetri pertama device, jadi device
  // didaftarkan di sini juga (dengan pemeriksaan kunci kolam yang sama).
  await resolveReportingDevice(deviceId, pondId);
  const device = await deviceRepository.updateActuators(deviceId, parsed.data);

  broadcast(
    'device:actuators',
    { id: device.id, actuators: device.actuators, actuators_updated_at: device.actuators_updated_at },
    { pondId, deviceId },
  );
  return device;
}

/** Device membalas sebuah perintah (topik `.../ack`). */
export async function ingestCommandAck(raw, { deviceId, pondId }) {
  const parsed = ackSchema.safeParse(raw);
  if (!parsed.success) {
    throw badRequest('Payload ack tidak valid', parsed.error.flatten());
  }

  const command = await commandRepository.markAcked(parsed.data.id, deviceId, parsed.data);
  if (!command) {
    log.warn(`ack untuk perintah ${parsed.data.id} dari ${deviceId} tidak cocok/kedaluwarsa`);
    return null;
  }
  if (command.status === 'failed') log.warn(`${deviceId} gagal menjalankan perintah: ${command.error}`);

  broadcast('command:updated', command, { pondId, deviceId });
  return command;
}

/** Tugas latar: tandai perintah tanpa balasan sebagai timeout. */
export async function expirePendingCommands() {
  const expired = await commandRepository.expirePending(config.commands.ackTimeoutSeconds);
  for (const command of expired) {
    log.warn(`perintah ${command.id} ke ${command.device_id} tidak dibalas (timeout)`);
    broadcast('command:updated', command, { pondId: command.pond_id, deviceId: command.device_id });
  }
}
