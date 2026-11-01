/**
 * Alur HTTP penuh terhadap database sungguhan: login -> kelola kolam & device
 * -> telemetri masuk -> alert terbuka -> ditandai -> pulih.
 * MQTT tidak dibutuhkan: telemetri dimasukkan lewat service yang sama dengan
 * handler MQTT.
 */
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../../src/app.js';
import { createOrUpdateUser } from '../../src/services/authService.js';
import { ingestTelemetry } from '../../src/services/telemetryService.js';

const app = createApp();
let admin;
let viewer;

async function login(username, password) {
  const res = await request(app).post('/api/auth/login').send({ username, password });
  expect(res.status).toBe(200);
  return `Bearer ${res.body.data.token}`;
}

beforeAll(async () => {
  await createOrUpdateUser({ username: 'admin', password: 'rahasia-admin', role: 'admin' });
  await createOrUpdateUser({ username: 'budi', password: 'rahasia-budi', role: 'viewer' });
  admin = await login('admin', 'rahasia-admin');
  viewer = await login('BUDI', 'rahasia-budi'); // username tidak peka kapital
});

describe('alur kolam, device, dan alert', () => {
  it('admin membuat kolam dan mendaftarkan device', async () => {
    let res = await request(app)
      .post('/api/ponds')
      .set('Authorization', admin)
      .send({ id: 'pond-01', name: 'Kolam A', fishType: 'Nila' });
    expect(res.status).toBe(201);

    res = await request(app)
      .post('/api/devices')
      .set('Authorization', admin)
      .send({ id: 'esp32-node-01', pondId: 'pond-01', name: 'Node A' });
    expect(res.status).toBe(201);

    res = await request(app)
      .post('/api/ponds')
      .set('Authorization', viewer)
      .send({ id: 'pond-x', name: 'X' });
    expect(res.status).toBe(403);
  });

  it('telemetri tersimpan dan muncul di overview beserta ambang', async () => {
    await ingestTelemetry({
      deviceId: 'esp32-node-01',
      pondId: 'pond-01',
      metrics: { temperature: 28, ph: 7.2, dissolvedOxygen: 7 },
    });

    const res = await request(app).get('/api/ponds/pond-01/overview').set('Authorization', viewer);
    expect(res.status).toBe(200);
    expect(res.body.data.latestReadings[0]).toMatchObject({ temperature: 28, ph: 7.2 });
    expect(res.body.data.thresholds.dissolved_oxygen).toMatchObject({ min: 5, max: 12 });
    expect(res.body.data.devices[0].status).toBe('online');
  });

  it('DO rendah dua kali berturut-turut membuka alert kritis', async () => {
    for (let i = 0; i < 2; i++) {
      await ingestTelemetry({ deviceId: 'esp32-node-01', pondId: 'pond-01', metrics: { dissolvedOxygen: 3 } });
    }
    const res = await request(app).get('/api/alerts?status=open').set('Authorization', viewer);
    expect(res.body.data).toEqual([
      expect.objectContaining({
        metric: 'dissolved_oxygen',
        severity: 'critical',
        pond_name: 'Kolam A',
        message: expect.stringContaining('di bawah batas aman'),
      }),
    ]);
  });

  it('viewer menandai alert, lalu alert pulih saat DO kembali normal', async () => {
    const open = (await request(app).get('/api/alerts?status=open').set('Authorization', viewer)).body.data[0];
    const ack = await request(app).post(`/api/alerts/${open.id}/acknowledge`).set('Authorization', viewer);
    expect(ack.body.data.acknowledged_by).toBe('budi');

    await ingestTelemetry({ deviceId: 'esp32-node-01', pondId: 'pond-01', metrics: { dissolvedOxygen: 7.5 } });

    const res = await request(app).get('/api/alerts?status=resolved').set('Authorization', viewer);
    expect(res.body.data.map((a) => a.id)).toContain(open.id);
  });

  it('override ambang per kolam langsung dipakai evaluasi', async () => {
    const res = await request(app)
      .put('/api/thresholds/temperature')
      .set('Authorization', admin)
      .send({ pondId: 'pond-01', min: 29, max: 31 });
    expect(res.body.data.temperature).toMatchObject({ min: 29, max: 31, source: 'pond' });

    // 28,8 di bawah 29 sejauh 0,2 < 15% lebar rentang (0,3) -> waspada, bukan kritis.
    for (let i = 0; i < 2; i++) {
      await ingestTelemetry({ deviceId: 'esp32-node-01', pondId: 'pond-01', metrics: { temperature: 28.8 } });
    }
    const alerts = (await request(app).get('/api/alerts?status=open').set('Authorization', viewer)).body.data;
    expect(alerts.find((a) => a.metric === 'temperature')).toMatchObject({ severity: 'warning' });
  });

  it('paket dari kolam lain ditolak karena device terkunci ke kolamnya', async () => {
    await expect(
      ingestTelemetry({ deviceId: 'esp32-node-01', pondId: 'pond-99', metrics: { ph: 7 } }),
    ).rejects.toThrow(/terdaftar di kolam "pond-01"/);

    const ponds = (await request(app).get('/api/ponds').set('Authorization', viewer)).body.data;
    expect(ponds.map((p) => p.id)).not.toContain('pond-99');
  });

  it('grafik agregat per jam membaca data terbaru', async () => {
    const res = await request(app)
      .get('/api/readings/aggregate?pondId=pond-01&bucket=1%20hour')
      .set('Authorization', viewer);
    expect(res.status).toBe(200);
    // Dijumlah semua bucket agar tidak goyah bila test berjalan tepat di pergantian jam.
    const total = res.body.data.reduce((sum, row) => sum + Number(row.sample_count), 0);
    expect(total).toBe(6); // 1 awal + 2 DO rendah + 1 pulih + 2 suhu
  });

  it('menghapus kolam ikut menghapus device, pembacaan, dan alert-nya', async () => {
    const res = await request(app).delete('/api/ponds/pond-01').set('Authorization', admin);
    expect(res.status).toBe(204);

    const alerts = (await request(app).get('/api/alerts').set('Authorization', viewer)).body.data;
    expect(alerts).toHaveLength(0);
  });
});
