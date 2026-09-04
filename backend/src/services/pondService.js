import * as deviceRepository from '../repositories/deviceRepository.js';
import * as pondRepository from '../repositories/pondRepository.js';
import * as readingRepository from '../repositories/readingRepository.js';
import { HttpError, notFound } from '../utils/errors.js';

export function listPonds() {
  return pondRepository.findAll();
}

export async function getPond(id) {
  const pond = await pondRepository.findById(id);
  if (!pond) throw notFound(`Kolam "${id}" tidak ditemukan`);
  return pond;
}

export async function createPond(input) {
  const existing = await pondRepository.findById(input.id);
  if (existing) throw new HttpError(409, `Kolam "${input.id}" sudah terdaftar`);
  return pondRepository.create(input);
}

export async function updatePond(id, input) {
  const pond = await pondRepository.update(id, input);
  if (!pond) throw notFound(`Kolam "${id}" tidak ditemukan`);
  return pond;
}

export async function deletePond(id) {
  const deleted = await pondRepository.remove(id);
  if (!deleted) throw notFound(`Kolam "${id}" tidak ditemukan`);
}

/** Kondisi terkini satu kolam: metadata + device + pembacaan terbaru. */
export async function getPondOverview(id) {
  const pond = await getPond(id);
  const [devices, latest] = await Promise.all([
    deviceRepository.findAll({ pondId: id }),
    readingRepository.findLatestByPond(id),
  ]);

  return {
    pond,
    devices,
    latestReadings: latest,
    onlineCount: devices.filter((d) => d.status === 'online').length,
  };
}

export async function getPondSummary(id, { from, to }) {
  await getPond(id);
  return readingRepository.summarize({ pondId: id, from, to });
}
