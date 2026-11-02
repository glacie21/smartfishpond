import { query } from '../db/pool.js';

/**
 * Daftar kolam beserta jumlah device dan pembacaan terbarunya, cukup satu
 * query untuk seluruh kartu dashboard. LATERAL + LIMIT 1 memakai index
 * (pond_id, recorded_at) sehingga tetap ringan meski tabel readings besar.
 */
export async function findAll() {
  const { rows } = await query(`
    SELECT p.*,
           (SELECT count(*)::int FROM devices d WHERE d.pond_id = p.id)                         AS device_count,
           (SELECT count(*)::int FROM devices d WHERE d.pond_id = p.id AND d.status = 'online') AS device_online,
           to_jsonb(r) AS latest_reading
    FROM ponds p
    LEFT JOIN LATERAL (
      SELECT recorded_at, temperature, ph, tds, dissolved_oxygen, turbidity, water_level
        FROM readings
       WHERE pond_id = p.id
       ORDER BY recorded_at DESC
       LIMIT 1
    ) r ON true
    ORDER BY p.created_at
  `);
  return rows;
}

export async function findById(id) {
  const { rows } = await query('SELECT * FROM ponds WHERE id = $1', [id]);
  return rows[0] ?? null;
}

export async function create({ id, name, location, depthCm, fishType }) {
  const { rows } = await query(
    `INSERT INTO ponds (id, name, location, depth_cm, fish_type)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [id, name, location ?? null, depthCm ?? null, fishType ?? null],
  );
  return rows[0];
}

export async function update(id, { name, location, depthCm, fishType }) {
  // COALESCE: field yang tidak dikirim tetap memakai nilai lama.
  const { rows } = await query(
    `UPDATE ponds
        SET name      = COALESCE($2, name),
            location  = COALESCE($3, location),
            depth_cm  = COALESCE($4, depth_cm),
            fish_type = COALESCE($5, fish_type)
      WHERE id = $1
      RETURNING *`,
    [id, name ?? null, location ?? null, depthCm ?? null, fishType ?? null],
  );
  return rows[0] ?? null;
}

export async function remove(id) {
  const { rowCount } = await query('DELETE FROM ponds WHERE id = $1', [id]);
  return rowCount > 0;
}

/**
 * Mendaftarkan kolam bila belum ada. Dipakai saat device baru mengirim
 * telemetri agar data tidak ditolak oleh foreign key.
 */
export async function ensureExists(id) {
  await query(
    `INSERT INTO ponds (id, name)
     VALUES ($1, $1)
     ON CONFLICT (id) DO NOTHING`,
    [id],
  );
}
