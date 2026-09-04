import { query } from '../db/pool.js';

const METRIC_COLUMNS = [
  'temperature',
  'ph',
  'tds',
  'dissolved_oxygen',
  'turbidity',
  'water_level',
];

export async function insert(reading) {
  const { rows } = await query(
    `INSERT INTO readings
       (device_id, pond_id, recorded_at, temperature, ph, tds,
        dissolved_oxygen, turbidity, water_level, rssi)
     VALUES ($1, $2, COALESCE($3, now()), $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [
      reading.deviceId,
      reading.pondId,
      reading.recordedAt ?? null,
      reading.temperature ?? null,
      reading.ph ?? null,
      reading.tds ?? null,
      reading.dissolvedOxygen ?? null,
      reading.turbidity ?? null,
      reading.waterLevel ?? null,
      reading.rssi ?? null,
    ],
  );
  return rows[0];
}

/** Pembacaan terbaru satu device (null bila belum pernah mengirim). */
export async function findLatestByDevice(deviceId) {
  const { rows } = await query(
    `SELECT * FROM readings
      WHERE device_id = $1
      ORDER BY recorded_at DESC
      LIMIT 1`,
    [deviceId],
  );
  return rows[0] ?? null;
}

/** Pembacaan terbaru setiap device pada sebuah kolam. */
export async function findLatestByPond(pondId) {
  const { rows } = await query(
    `SELECT * FROM latest_readings WHERE pond_id = $1 ORDER BY device_id`,
    [pondId],
  );
  return rows;
}

/**
 * Data historis mentah dalam rentang waktu.
 * `limit` membatasi jumlah baris agar respons tidak membengkak.
 */
export async function findHistory({ pondId, deviceId, from, to, limit = 1000 }) {
  const { rows } = await query(
    `SELECT * FROM readings
      WHERE ($1::text IS NULL OR pond_id = $1)
        AND ($2::text IS NULL OR device_id = $2)
        AND ($3::timestamptz IS NULL OR recorded_at >= $3)
        AND ($4::timestamptz IS NULL OR recorded_at <= $4)
      ORDER BY recorded_at DESC
      LIMIT $5`,
    [pondId ?? null, deviceId ?? null, from ?? null, to ?? null, limit],
  );
  return rows.reverse(); // urut naik agar siap digambar sebagai grafik
}

/**
 * Rata-rata/min/max per bucket waktu, dihitung langsung dari data mentah
 * dengan date_bin sehingga rentang bucket bebas (mis. '15 minutes').
 */
export async function findAggregated({ pondId, deviceId, from, to, bucket = '1 hour' }) {
  const { rows } = await query(
    `SELECT date_bin($5::interval, recorded_at, TIMESTAMPTZ '2000-01-01') AS bucket,
            count(*) AS sample_count,
            ${METRIC_COLUMNS.map(
              (c) => `avg(${c}) AS ${c}_avg, min(${c}) AS ${c}_min, max(${c}) AS ${c}_max`,
            ).join(',\n            ')}
       FROM readings
      WHERE ($1::text IS NULL OR pond_id = $1)
        AND ($2::text IS NULL OR device_id = $2)
        AND ($3::timestamptz IS NULL OR recorded_at >= $3)
        AND ($4::timestamptz IS NULL OR recorded_at <= $4)
      GROUP BY bucket
      ORDER BY bucket`,
    [pondId ?? null, deviceId ?? null, from ?? null, to ?? null, bucket],
  );
  return rows;
}

/** Ringkasan statistik satu kolam untuk rentang tertentu. */
export async function summarize({ pondId, from, to }) {
  const { rows } = await query(
    `SELECT count(*) AS sample_count,
            min(recorded_at) AS first_at,
            max(recorded_at) AS last_at,
            ${METRIC_COLUMNS.map(
              (c) => `avg(${c}) AS ${c}_avg, min(${c}) AS ${c}_min, max(${c}) AS ${c}_max`,
            ).join(',\n            ')}
       FROM readings
      WHERE pond_id = $1
        AND ($2::timestamptz IS NULL OR recorded_at >= $2)
        AND ($3::timestamptz IS NULL OR recorded_at <= $3)`,
    [pondId, from ?? null, to ?? null],
  );
  return rows[0];
}

/** Menghapus data mentah yang lebih tua dari retensi. */
export async function deleteOlderThan(days) {
  const { rowCount } = await query(
    `DELETE FROM readings WHERE recorded_at < now() - ($1 || ' days')::interval`,
    [days],
  );
  return rowCount;
}
