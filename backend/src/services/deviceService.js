import * as deviceRepository from '../repositories/deviceRepository.js';
import * as pondRepository from '../repositories/pondRepository.js';
import * as readingRepository from '../repositories/readingRepository.js';
import { badRequest, HttpError, notFound } from '../utils/errors.js';

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

/**
 * Device yang mengirim pesan MQTT: dicari, atau didaftarkan bila baru
 * (auto-provisioning). Dipakai semua jenis pesan device (telemetri, status,
 * aktuator) karena urutan kedatangannya tidak dijamin.
 *
 * Device yang sudah terdaftar terkunci pada kolamnya: pesan yang topiknya
 * menyebut kolam lain ditolak, sehingga device yang bobol tidak bisa
 * mengotori data kolam lain. Pindah kolam dilakukan lewat PATCH /devices/:id.
 */
export async function resolveReportingDevice(deviceId, pondId) {
  const existing = await deviceRepository.findById(deviceId);
  if (existing) {
    if (existing.pond_id !== pondId) {
      throw badRequest(
        `${deviceId} terdaftar di kolam "${existing.pond_id}", bukan "${pondId}"; paket ditolak`,
      );
    }
    return existing;
  }

  // Urutannya penting: kolam dulu, lalu device (foreign key).
  await pondRepository.ensureExists(pondId);
  const device = await deviceRepository.ensureExists(deviceId, pondId);
  if (device.pond_id !== pondId) {
    // Balapan: device baru saja didaftarkan pesan lain dengan kolam berbeda.
    throw badRequest(`${deviceId} terdaftar di kolam "${device.pond_id}", bukan "${pondId}"`);
  }
  return device;
}

async function assertPondExists(pondId) {
  if (!(await pondRepository.findById(pondId))) throw notFound(`Kolam "${pondId}" tidak ditemukan`);
}

/**
 * Pendaftaran manual. Opsional — device juga terdaftar otomatis saat paket
 * pertamanya masuk — tapi berguna untuk menetapkan kolamnya sejak awal.
 */
export async function createDevice({ id, pondId, name }) {
  await assertPondExists(pondId);
  if (await deviceRepository.findById(id)) {
    throw new HttpError(409, `Device "${id}" sudah terdaftar`);
  }
  return deviceRepository.create({ id, pondId, name });
}

/**
 * Mengubah nama dan/atau kolam device. Setelah dipindah, POND_ID di firmware
 * harus disesuaikan: paket dari kolam lama akan ditolak.
 */
export async function updateDevice(id, { name, pondId }) {
  if (pondId) await assertPondExists(pondId);
  const device = await deviceRepository.update(id, { name, pondId });
  if (!device) throw notFound(`Device "${id}" tidak ditemukan`);
  return device;
}

/** Menghapus device beserta seluruh pembacaan & alert-nya (ON DELETE CASCADE). */
export async function deleteDevice(id) {
  const deleted = await deviceRepository.remove(id);
  if (!deleted) throw notFound(`Device "${id}" tidak ditemukan`);
}
