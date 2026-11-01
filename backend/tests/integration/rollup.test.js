import { beforeAll, describe, expect, it } from 'vitest';

import { pool } from '../../src/db/pool.js';
import * as readingRepository from '../../src/repositories/readingRepository.js';

const METRICS = ['temperature', 'ph', 'tds', 'dissolved_oxygen', 'turbidity', 'water_level'];
const HOUR = 3_600_000;

/** Bandingkan hasil rollup dengan perhitungan langsung dari data mentah. */
function expectSameAggregates(raw, hourly) {
  expect(hourly).toHaveLength(raw.length);
  raw.forEach((r, i) => {
    const h = hourly[i];
    expect(new Date(h.bucket).getTime()).toBe(new Date(r.bucket).getTime());
    expect(Number(h.sample_count)).toBe(Number(r.sample_count));
    for (const m of METRICS) {
      for (const stat of ['avg', 'min', 'max']) {
        const key = `${m}_${stat}`;
        if (r[key] === null) expect(h[key]).toBeNull();
        else expect(Number(h[key])).toBeCloseTo(Number(r[key]), 6);
      }
    }
  });
}

/** Pembacaan deterministik tiap `stepMin` menit; sebagian metrik null. */
async function insertReadings(deviceId, pondId, fromMs, toMs, stepMin) {
  let i = 0;
  for (let t = fromMs; t <= toMs; t += stepMin * 60_000, i++) {
    const v = (base, spread) => (i % 11 === 3 ? null : Number((base + ((i * 37) % 100) / 100 * spread).toFixed(2)));
    await pool.query(
      `INSERT INTO readings (device_id, pond_id, recorded_at, temperature, ph, tds, dissolved_oxygen, turbidity, water_level)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [deviceId, pondId, new Date(t), v(26, 6), v(6.5, 2), v(100, 400), v(4, 6), v(0, 60), v(80, 30)],
    );
  }
}

const now = Date.now();
const start = Math.floor((now - 30 * HOUR) / HOUR) * HOUR; // rata ke awal jam
const range = { from: new Date(start).toISOString(), to: new Date(now + 60_000).toISOString() };

beforeAll(async () => {
  await pool.query(`INSERT INTO ponds (id, name) VALUES ('pond-01', 'A')`);
  await pool.query(`INSERT INTO devices (id, pond_id) VALUES ('dev-1', 'pond-01'), ('dev-2', 'pond-01')`);
  await insertReadings('dev-1', 'pond-01', start, now, 15);
  await insertReadings('dev-2', 'pond-01', start + 7 * 60_000, now, 20);
  await readingRepository.rollupHourly();
});

describe('readings_hourly', () => {
  it.each(['1 hour', '6 hours', '1 day'])('bucket %s identik dengan perhitungan dari data mentah', async (bucket) => {
    const filter = { pondId: 'pond-01', ...range, bucket };
    expectSameAggregates(
      await readingRepository.findAggregated(filter),
      await readingRepository.findAggregatedFromHourly(filter),
    );
  });

  it('menangkap data bertimestamp lampau yang masuk belakangan', async () => {
    await insertReadings('dev-1', 'pond-01', start + 5 * HOUR + 2 * 60_000, start + 6 * HOUR, 9);
    const updated = await readingRepository.rollupHourly();
    expect(updated).toBeGreaterThan(0);

    const filter = { pondId: 'pond-01', ...range, bucket: '1 hour' };
    expectSameAggregates(
      await readingRepository.findAggregated(filter),
      await readingRepository.findAggregatedFromHourly(filter),
    );
  });

  it('riwayat per jam tetap ada setelah data mentah dihapus retensi', async () => {
    const before = await readingRepository.findAggregatedFromHourly({ pondId: 'pond-01', ...range, bucket: '1 day' });
    await pool.query(`DELETE FROM readings WHERE recorded_at < now() - interval '3 hours'`);
    await readingRepository.rollupHourly();

    const after = await readingRepository.findAggregatedFromHourly({ pondId: 'pond-01', ...range, bucket: '1 day' });
    const total = (rows) => rows.reduce((sum, r) => sum + Number(r.sample_count), 0);
    expect(total(after)).toBe(total(before));
  });

  it('menghapus device ikut menghapus rollup-nya', async () => {
    await pool.query(`DELETE FROM devices WHERE id = 'dev-2'`);
    const { rows } = await pool.query(`SELECT count(*)::int AS n FROM readings_hourly WHERE device_id = 'dev-2'`);
    expect(rows[0].n).toBe(0);
  });
});
