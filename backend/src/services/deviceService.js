import * as deviceRepository from '../repositories/deviceRepository.js';
import * as readingRepository from '../repositories/readingRepository.js';
import { notFound } from '../utils/errors.js';

export function listDevices(filter) {
  return deviceRepository.findAll(filter);
}

export async function getDevice(id) {
  const device = await deviceRepository.findById(id);
  if (!device) throw notFound(`Device "${id}" tidak ditemukan`);
  return device;
}

export async function getDeviceWithLatest(id) {
  const device = await getDevice(id);
  const latestReading = await readingRepository.findLatestByDevice(id);
  return { ...device, latestReading };
}
