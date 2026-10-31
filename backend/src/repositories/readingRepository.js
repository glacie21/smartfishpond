import { query, withTransaction } from '../db/pool.js';

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

/** Ekspresi agregat per metrik untuk mengisi readings_hourly dari data mentah. */
const HOURLY_METRIC_AGGREGATES = METRIC_COLUMNS.map(
  (c) => `sum(${c}) AS ${c}_sum, count(${c}) AS ${c}_count, min(${c}) AS ${c}_min, max(${c}) AS ${c}_max`,
).join(',\n            ');

const HOURLY_METRIC_COLUMNS = METRIC_COLUMNS.flatMap((c) => [
  `${c}_sum`,
  `${c}_count`,
  `${c}_min`,
  `${c}_max`,
]);

/**
 * Agregat per bucket dari tabel rollup readings_hourly — untuk bucket >= 1 jam.
 *
 * Jam yang mungkin belum ter-rollup (jam berjalan dan satu jam sebelumnya)
 * dihitung langsung dari data mentah, sehingga hasilnya tetap mutakhir tanpa
 * menunggu tugas rollup. Rata-rata = total sum / total count agar akurat saat
 * beberapa jam digabung.
 */
export async function findAggregatedFromHourly({ pondId, deviceId, from, to, bucket }) {
  const rawPart = METRIC_COLUMNS.map(
    (c) => `sum(${c}), count(${c}), min(${c}), max(${c})`,
  ).join(', ');

  const { rows } = await query(
    `WITH cutoff AS (SELECT date_trunc('hour', now() - interval '1 hour') AS at),
     hourly (bucket, sample_count, ${HOURLY_METRIC_COLUMNS.join(', ')}) AS (
       SELECT bucket, sample_count, ${HOURLY_METRIC_COLUMNS.join(', ')}
         FROM readings_hourly, cutoff
        WHERE ($1::text IS NULL OR pond_id = $1)
          AND ($2::text IS NULL OR device_id = $2)
          AND ($3::timestamptz IS NULL OR bucket >= date_trunc('hour', $3::timestamptz))
          AND ($4::timestamptz IS NULL OR bucket <= $4)
          AND bucket < cutoff.at
       UNION ALL
       SELECT date_trunc('hour', recorded_at), count(*), ${rawPart}
         FROM readings, cutoff
        WHERE ($1::text IS NULL OR pond_id = $1)
          AND ($2::text IS NULL OR device_id = $2)
          AND recorded_at >= GREATEST(cutoff.at, COALESCE($3::timestamptz, cutoff.at))
          AND ($4::timestamptz IS NULL OR recorded_at <= $4)
        GROUP BY 1
     )
     SELECT date_bin($5::interval, bucket, TIMESTAMPTZ '2000-01-01') AS bucket,
            sum(sample_count) AS sample_count,
            ${METRIC_COLUMNS.map(
              (c) =>
                `sum(${c}_sum) / NULLIF(sum(${c}_count), 0) AS ${c}_avg, ` +
                `min(${c}_min) AS ${c}_min, max(${c}_max) AS ${c}_max`,
            ).join(',\n            ')}
       FROM hourly
      GROUP BY 1
      ORDER BY 1`,
    [pondId ?? null, deviceId ?? null, from ?? null, to ?? null, bucket],
  );
  return rows;
}

/**
 * Memperbarui readings_hourly secara bertahap.
 *
 * Jam yang dihitung ulang: jam dari reading baru sejak rollup terakhir
 * (berdasarkan id, jadi data bertimestamp lampau — seed, buffer offline —
 * ikut tertangkap) ditambah dua jam terakhir (menangkap transaksi yang
 * commit terlambat). Setiap jam dihitung ulang penuh, sehingga aman diulang.
 *
 * @returns jumlah bucket (device × kolam × jam) yang diperbarui
 */
export async function rollupHourly() {
  return withTransaction(async (client) => {
    // FOR UPDATE: mencegah dua proses rollup berjalan bersamaan.
    const state = await client.query(
      `SELECT last_reading_id FROM rollup_state WHERE name = 'readings_hourly' FOR UPDATE`,
    );
    const lastId = state.rows[0]?.last_reading_id ?? 0;
    const { rows: maxRows } = await client.query('SELECT COALESCE(max(id), 0) AS max_id FROM readings');
    const maxId = maxRows[0].max_id;

    const { rowCount } = await client.query(
      // UNION (bukan OR) agar kedua cabang memakai indeks: PK id & recorded_at.
      `WITH touched AS (
         SELECT device_id, pond_id, date_trunc('hour', recorded_at) AS bucket
           FROM readings WHERE id > $1
         UNION
         SELECT device_id, pond_id, date_trunc('hour', recorded_at)
           FROM readings WHERE recorded_at >= date_trunc('hour', now() - interval '2 hours')
       )
       INSERT INTO readings_hourly (device_id, pond_id, bucket, sample_count, ${HOURLY_METRIC_COLUMNS.join(', ')})
       SELECT r.device_id, r.pond_id, t.bucket, count(*),
              ${HOURLY_METRIC_AGGREGATES}
         FROM touched t
         JOIN readings r
           ON r.device_id = t.device_id
          AND r.pond_id = t.pond_id
          AND r.recorded_at >= t.bucket
          AND r.recorded_at < t.bucket + interval '1 hour'
        GROUP BY r.device_id, r.pond_id, t.bucket
       ON CONFLICT (device_id, pond_id, bucket) DO UPDATE
          SET sample_count = EXCLUDED.sample_count,
              ${HOURLY_METRIC_COLUMNS.map((c) => `${c} = EXCLUDED.${c}`).join(',\n              ')},
              updated_at = now()`,
      [lastId],
    );

    await client.query(
      `INSERT INTO rollup_state (name, last_reading_id, updated_at)
       VALUES ('readings_hourly', $1, now())
       ON CONFLICT (name) DO UPDATE
         SET last_reading_id = GREATEST(rollup_state.last_reading_id, EXCLUDED.last_reading_id),
             updated_at = now()`,
      [maxId],
    );
    return rowCount;
  });
}

/** Menghapus rollup per jam yang lebih tua dari retensinya. */
export async function deleteHourlyOlderThan(days) {
  const { rowCount } = await query(
    `DELETE FROM readings_hourly WHERE bucket < now() - ($1 || ' days')::interval`,
    [days],
  );
  return rowCount;
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
