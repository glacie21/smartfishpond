import { query } from '../db/pool.js';

export async function findAll() {
  const { rows } = await query(`
    SELECT p.*,
           count(d.id) FILTER (WHERE d.id IS NOT NULL)          AS device_count,
           count(d.id) FILTER (WHERE d.status = 'online')       AS device_online
    FROM ponds p
    LEFT JOIN devices d ON d.pond_id = p.id
    GROUP BY p.id
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
