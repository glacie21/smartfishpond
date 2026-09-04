#!/usr/bin/env node
/**
 * Mengisi database dengan data contoh: dua kolam, dua device, dan
 * riwayat pembacaan tujuh hari terakhir (interval 10 menit) sehingga
 * grafik dashboard langsung ada isinya.
 *
 * Pemakaian:
 *   npm run seed
 *   DATABASE_URL=postgres://... node scripts/seed.js
 */
import 'dotenv/config';
import pg from 'pg';

const DATABASE_URL =
  process.env.DATABASE_URL ??
  'postgres://fishpond:fishpond@localhost:5432/smartfishpond';

const DAYS = 7;
const STEP_MINUTES = 10;

const PONDS = [
  { id: 'pond-01', name: 'Kolam A - Nila', location: 'Blok Utara', depthCm: 120, fishType: 'Nila' },
  { id: 'pond-02', name: 'Kolam B - Lele', location: 'Blok Selatan', depthCm: 100, fishType: 'Lele' },
];

const DEVICES = [
  { id: 'esp32-node-01', pondId: 'pond-01', name: 'Node Kolam A' },
  { id: 'esp32-node-02', pondId: 'pond-02', name: 'Node Kolam B' },
];

const random = (min, max) => Math.random() * (max - min) + min;
const round = (value, d) => Number(value.toFixed(d));

/** Pembacaan sintetis pada satu titik waktu (suhu mengikuti siklus harian). */
function syntheticReading(timestamp) {
  const hour = timestamp.getHours() + timestamp.getMinutes() / 60;
  return {
    temperature: round(28 + 2.5 * Math.sin(((hour - 9) / 24) * 2 * Math.PI) + random(-0.3, 0.3), 2),
    ph: round(random(6.8, 7.8), 2),
    tds: round(random(200, 400), 1),
    dissolvedOxygen: round(random(5.5, 8.5), 2),
    turbidity: round(random(5, 35), 1),
    waterLevel: round(random(88, 102), 1),
  };
}

async function main() {
  const pool = new pg.Pool({ connectionString: DATABASE_URL });

  try {
    for (const pond of PONDS) {
      await pool.query(
        `INSERT INTO ponds (id, name, location, depth_cm, fish_type)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (id) DO UPDATE
           SET name = EXCLUDED.name, location = EXCLUDED.location`,
        [pond.id, pond.name, pond.location, pond.depthCm, pond.fishType],
      );
    }
    console.log(`${PONDS.length} kolam disiapkan`);

    for (const device of DEVICES) {
      await pool.query(
        `INSERT INTO devices (id, pond_id, name, status, last_seen_at)
         VALUES ($1, $2, $3, 'online', now())
         ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`,
        [device.id, device.pondId, device.name],
      );
    }
    console.log(`${DEVICES.length} device disiapkan`);

    // Sisipkan riwayat secara batch agar tidak ribuan round-trip.
    const now = Date.now();
    const totalSteps = (DAYS * 24 * 60) / STEP_MINUTES;
    let inserted = 0;

    for (const device of DEVICES) {
      const values = [];
      const params = [];

      for (let i = totalSteps; i >= 0; i--) {
        const timestamp = new Date(now - i * STEP_MINUTES * 60 * 1000);
        const r = syntheticReading(timestamp);
        const base = params.length;

        values.push(
          `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, ` +
            `$${base + 6}, $${base + 7}, $${base + 8}, $${base + 9})`,
        );
        params.push(
          device.id,
          device.pondId,
          timestamp,
          r.temperature,
          r.ph,
          r.tds,
          r.dissolvedOxygen,
          r.turbidity,
          r.waterLevel,
        );
      }

      const { rowCount } = await pool.query(
        `INSERT INTO readings
           (device_id, pond_id, recorded_at, temperature, ph, tds,
            dissolved_oxygen, turbidity, water_level)
         VALUES ${values.join(', ')}`,
        params,
      );
      inserted += rowCount;
    }

    console.log(`${inserted} baris pembacaan (${DAYS} hari terakhir) ditambahkan`);
    console.log('Seed selesai.');
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(`Seed gagal: ${err.message}`);
  process.exit(1);
});
