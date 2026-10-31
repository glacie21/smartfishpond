import { query } from '../db/pool.js';

export async function findAll({ pondId } = {}) {
  const { rows } = await query(
    `SELECT * FROM devices
      WHERE ($1::text IS NULL OR pond_id = $1)
      ORDER BY created_at`,
    [pondId ?? null],
  );
  return rows;
}

export async function findById(id) {
  const { rows } = await query('SELECT * FROM devices WHERE id = $1', [id]);
  return rows[0] ?? null;
}

/**
 * Auto-provisioning: device yang belum terdaftar dibuat saat paket
 * pertamanya masuk, sehingga tidak perlu registrasi manual.
 *
 * Kolam device yang SUDAH terdaftar tidak diubah di sini — pemindahan kolam
 * hanya lewat API (PATCH /devices/:id). Mengembalikan baris device.
 */
export async function ensureExists(id, pondId) {
  const { rows } = await query(
    `INSERT INTO devices (id, pond_id, name)
     VALUES ($1, $2, $1)
     ON CONFLICT (id) DO UPDATE SET id = devices.id
     RETURNING *`,
    [id, pondId],
  );
  return rows[0];
}

export async function create({ id, pondId, name }) {
  const { rows } = await query(
    `INSERT INTO devices (id, pond_id, name)
     VALUES ($1, $2, COALESCE($3, $1))
     RETURNING *`,
    [id, pondId, name ?? null],
  );
  return rows[0];
}

export async function update(id, { name, pondId }) {
  const { rows } = await query(
    `UPDATE devices
        SET name    = COALESCE($2, name),
            pond_id = COALESCE($3, pond_id)
      WHERE id = $1
      RETURNING *`,
    [id, name ?? null, pondId ?? null],
  );
  return rows[0] ?? null;
}

export async function remove(id) {
  const { rowCount } = await query('DELETE FROM devices WHERE id = $1', [id]);
  return rowCount > 0;
}

export async function updateActuators(id, actuators) {
  const { rows } = await query(
    `UPDATE devices
        SET actuators = $2::jsonb, actuators_updated_at = now()
      WHERE id = $1
      RETURNING *`,
    [id, JSON.stringify(actuators)],
  );
  return rows[0] ?? null;
}

export async function updateStatus(id, { status, ipAddress, rssi, uptimeS }) {
  const { rows } = await query(
    `UPDATE devices
        SET status       = COALESCE($2, status),
            ip_address   = COALESCE($3, ip_address),
            rssi         = COALESCE($4, rssi),
            uptime_s     = COALESCE($5, uptime_s),
            last_seen_at = now()
      WHERE id = $1
      RETURNING *`,
    [id, status ?? null, ipAddress ?? null, rssi ?? null, uptimeS ?? null],
  );
  return rows[0] ?? null;
}

/**
 * Menandai offline device yang tidak mengirim apa pun melebihi ambang batas.
 * Jaring pengaman bila Last Will MQTT tidak sampai (mis. broker restart).
 */
export async function markStaleOffline(thresholdSeconds) {
  const { rows } = await query(
    `UPDATE devices
        SET status = 'offline'
      WHERE status = 'online'
        AND (last_seen_at IS NULL OR last_seen_at < now() - ($1 || ' seconds')::interval)
      RETURNING id, pond_id`,
    [thresholdSeconds],
  );
  return rows;
}
