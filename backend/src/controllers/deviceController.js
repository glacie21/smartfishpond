import { z } from 'zod';

import * as deviceControlService from '../services/deviceControlService.js';
import * as deviceService from '../services/deviceService.js';

const idSchema = z.string().min(1).max(64).regex(/^[a-zA-Z0-9_-]+$/, 'hanya huruf, angka, - dan _');

export const createDeviceSchema = z.object({
  id: idSchema,
  pondId: idSchema,
  name: z.string().min(1).max(120).optional(),
});

export const updateDeviceSchema = z
  .object({
    name: z.string().min(1).max(120).optional(),
    pondId: idSchema.optional(),
  })
  .refine((body) => body.name !== undefined || body.pondId !== undefined, {
    message: 'Isi minimal salah satu: name atau pondId',
  });

export const commandSchema = z.object({
  actuator: z.enum(deviceControlService.ACTUATORS),
  state: z.boolean(),
  // Menyala otomatis mati setelah sekian detik (mis. feeder 10 detik).
  durationS: z.number().int().positive().max(deviceControlService.MAX_DURATION_S).optional(),
});

export const commandListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export async function list(req, res) {
  const devices = await deviceService.listDevices({ pondId: req.query.pondId });
  res.json({ data: devices });
}

export async function detail(req, res) {
  res.json({ data: await deviceService.getDeviceWithLatest(req.params.id) });
}

export async function create(req, res) {
  res.status(201).json({ data: await deviceService.createDevice(req.validated.body) });
}

export async function update(req, res) {
  res.json({ data: await deviceService.updateDevice(req.params.id, req.validated.body) });
}

export async function remove(req, res) {
  await deviceService.deleteDevice(req.params.id);
  res.status(204).end();
}

export async function sendCommand(req, res) {
  const command = await deviceControlService.sendCommand(
    req.params.id,
    req.validated.body,
    req.user.username,
  );
  // 202: perintah diterima & dikirim; hasilnya menyusul lewat ack dari device.
  res.status(202).json({ data: command });
}

export async function listCommands(req, res) {
  const { limit } = req.validated.query;
  res.json({ data: await deviceControlService.listCommands(req.params.id, limit) });
}
