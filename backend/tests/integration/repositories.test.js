import { beforeAll, describe, expect, it } from 'vitest';

import { pool } from '../../src/db/pool.js';
import * as alertRepository from '../../src/repositories/alertRepository.js';
import * as commandRepository from '../../src/repositories/commandRepository.js';
import * as deviceRepository from '../../src/repositories/deviceRepository.js';
import * as thresholdRepository from '../../src/repositories/thresholdRepository.js';
import * as userRepository from '../../src/repositories/userRepository.js';

beforeAll(async () => {
  await pool.query(`INSERT INTO ponds (id, name) VALUES ('pond-01', 'Kolam A'), ('pond-02', 'Kolam B')`);
  await pool.query(`INSERT INTO devices (id, pond_id, name) VALUES ('dev-1', 'pond-01', 'Node A')`);
});

describe('thresholdRepository', () => {
  it('migrasi mengisi default enam metrik', async () => {
    const rows = await thresholdRepository.findEffective(null);
    expect(rows).toHaveLength(6);
    expect(rows.every((r) => r.source === 'default')).toBe(true);
  });

  it('override kolam menggantikan default hanya untuk kolam itu', async () => {
    await thresholdRepository.upsertForPond('pond-01', 'temperature', { min: 27, max: 30 });
    await thresholdRepository.upsertForPond('pond-01', 'temperature', { min: 27.5, max: 30.5 }); // upsert, bukan duplikat

    const pond1 = await thresholdRepository.findEffective('pond-01');
    const temp1 = pond1.find((r) => r.metric === 'temperature');
    expect(temp1).toMatchObject({ min_value: 27.5, max_value: 30.5, source: 'pond' });

    const pond2 = await thresholdRepository.findEffective('pond-02');
    expect(pond2.find((r) => r.metric === 'temperature')).toMatchObject({ min_value: 26, source: 'default' });
  });

  it('hapus override mengembalikan ke default', async () => {
    expect(await thresholdRepository.removeForPond('pond-01', 'temperature')).toBe(true);
    const rows = await thresholdRepository.findEffective('pond-01');
    expect(rows.find((r) => r.metric === 'temperature').source).toBe('default');
  });
});

describe('alertRepository', () => {
  const base = { pondId: 'pond-01', deviceId: 'dev-1', type: 'metric', metric: 'ph', severity: 'warning', message: 'pH rendah' };

  it('paling banyak satu alert terbuka per device-metrik', async () => {
    const first = await alertRepository.create({ ...base, value: 6.2 });
    const duplicate = await alertRepository.create({ ...base, value: 6.1 });
    expect(first).toMatchObject({ pond_name: 'Kolam A', device_name: 'Node A' });
    expect(duplicate).toBeNull();

    await alertRepository.resolve(first.id);
    const reopened = await alertRepository.create({ ...base, value: 6.0 });
    expect(reopened).not.toBeNull();
  });

  it('acknowledge hanya sekali', async () => {
    const [open] = await alertRepository.findMany({ status: 'open' });
    expect(await alertRepository.acknowledge(open.id, 'budi')).toBe(true);
    expect(await alertRepository.acknowledge(open.id, 'ani')).toBe(false);
  });

  it('device offline lama dan baru-baru ini terlihat butuh alert, sekali saja', async () => {
    await pool.query(
      `UPDATE devices SET status = 'offline', last_seen_at = now() - interval '10 minutes' WHERE id = 'dev-1'`,
    );
    const needing = await alertRepository.findDevicesNeedingOfflineAlert(300);
    expect(needing.map((d) => d.id)).toEqual(['dev-1']);

    await alertRepository.create({ ...base, type: 'device_offline', metric: null, severity: 'critical', message: 'offline' });
    expect(await alertRepository.findDevicesNeedingOfflineAlert(300)).toHaveLength(0);
  });

  it('device yang sudah lama dipensiunkan (> 7 hari) tidak memicu alert', async () => {
    await pool.query(`INSERT INTO devices (id, pond_id, status, last_seen_at)
                      VALUES ('dev-old', 'pond-02', 'offline', now() - interval '30 days')`);
    const ids = (await alertRepository.findDevicesNeedingOfflineAlert(300)).map((d) => d.id);
    expect(ids).not.toContain('dev-old');
  });
});

describe('commandRepository', () => {
  it('ack hanya diterima dari device yang dituju dan hanya sekali', async () => {
    const command = await commandRepository.create({
      deviceId: 'dev-1', actuator: 'aerator', state: true, requestedBy: 'admin',
    });
    expect(await commandRepository.markAcked(command.id, 'dev-lain', { ok: true })).toBeNull();
    expect(await commandRepository.markAcked(command.id, 'dev-1', { ok: true })).toMatchObject({ status: 'done' });
    expect(await commandRepository.markAcked(command.id, 'dev-1', { ok: false })).toBeNull();
  });

  it('perintah tanpa balasan menjadi timeout dan membawa pond_id', async () => {
    const command = await commandRepository.create({
      deviceId: 'dev-1', actuator: 'pump', state: true, durationS: 60, requestedBy: 'admin',
    });
    await pool.query(`UPDATE device_commands SET created_at = now() - interval '1 minute' WHERE id = $1`, [command.id]);

    const expired = await commandRepository.expirePending(30);
    expect(expired).toEqual([expect.objectContaining({ id: command.id, status: 'timeout', pond_id: 'pond-01' })]);
  });
});

describe('deviceRepository', () => {
  it('auto-provisioning tidak memindah kolam device yang sudah terdaftar', async () => {
    const device = await deviceRepository.ensureExists('dev-1', 'pond-02');
    expect(device.pond_id).toBe('pond-01');
  });

  it('menyimpan status aktuator sebagai JSON', async () => {
    const device = await deviceRepository.updateActuators('dev-1', { aerator: true, pump: false });
    expect(device.actuators).toEqual({ aerator: true, pump: false });
    expect(device.actuators_updated_at).not.toBeNull();
  });
});

describe('userRepository', () => {
  it('username disimpan huruf kecil dan login tidak peka kapital', async () => {
    await userRepository.upsert({ username: 'Pak.Budi', passwordHash: 'x', role: 'viewer' });
    const user = await userRepository.findByUsername('PAK.BUDI');
    expect(user).toMatchObject({ username: 'pak.budi', role: 'viewer' });
  });
});

// Ditaruh paling akhir: query yang gagal membuat pg-pool membuang koneksinya,
// dan server PGlite (dipakai untuk menjalankan test ini tanpa Docker) tidak
// tahan putus-sambung secepat itu. Di PostgreSQL biasa urutan tidak berpengaruh.
describe('constraint database', () => {
  it('menolak ambang dengan min >= max', async () => {
    await expect(thresholdRepository.upsertDefault('ph', { min: 9, max: 7 })).rejects.toThrow();
  });

  it('menolak peran di luar admin/viewer', async () => {
    await expect(userRepository.upsert({ username: 'x1', passwordHash: 'x', role: 'superuser' })).rejects.toThrow();
  });
});
