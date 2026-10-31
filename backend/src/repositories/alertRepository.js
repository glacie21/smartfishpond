import { query } from '../db/pool.js';

const SELECT_WITH_NAMES = `
  SELECT a.*, p.name AS pond_name, d.name AS device_name
    FROM alerts a
    JOIN ponds p   ON p.id = a.pond_id
    JOIN devices d ON d.id = a.device_id`;

/** Alert terbuka milik satu device (semua jenis). */
export async function findOpenByDevice(deviceId) {
  const { rows } = await query(
    'SELECT * FROM alerts WHERE device_id = $1 AND resolved_at IS NULL',
    [deviceId],
  );
  return rows;
}

export async function findById(id) {
  const { rows } = await query(`${SELECT_WITH_NAMES} WHERE a.id = $1`, [id]);
  return rows[0] ?? null;
}

/**
 * Daftar alert terbaru.
 * @param status 'open' | 'resolved' | 'all'
 */
export async function findMany({ status = 'all', pondId, limit = 100 }) {
  const { rows } = await query(
    `${SELECT_WITH_NAMES}
      WHERE ($1 = 'all'
             OR ($1 = 'open' AND a.resolved_at IS NULL)
             OR ($1 = 'resolved' AND a.resolved_at IS NOT NULL))
        AND ($2::text IS NULL OR a.pond_id = $2)
      ORDER BY a.resolved_at IS NULL DESC, a.started_at DESC
      LIMIT $3`,
    [status, pondId ?? null, limit],
  );
  return rows;
}

export async function create(alert) {
  const { rows } = await query(
    `INSERT INTO alerts
       (pond_id, device_id, type, metric, severity, value, min_value, max_value, message)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT DO NOTHING
     RETURNING id`,
    [
      alert.pondId,
      alert.deviceId,
      alert.type,
      alert.metric ?? null,
      alert.severity,
      alert.value ?? null,
      alert.min ?? null,
      alert.max ?? null,
      alert.message,
    ],
  );
  // null bila alert serupa sudah terbuka (balapan dua paket bersamaan).
  return rows[0] ? findById(rows[0].id) : null;
}

/** Memperbarui nilai terakhir; severity & pesan ikut berubah saat eskalasi. */
export async function update(id, { value, severity, message }) {
  await query(
    `UPDATE alerts
        SET value      = COALESCE($2, value),
            severity   = COALESCE($3, severity),
            message    = COALESCE($4, message),
            updated_at = now()
      WHERE id = $1`,
    [id, value ?? null, severity ?? null, message ?? null],
  );
  return findById(id);
}

export async function resolve(id) {
  await query(
    `UPDATE alerts SET resolved_at = now(), updated_at = now()
      WHERE id = $1 AND resolved_at IS NULL`,
    [id],
  );
  return findById(id);
}

export async function acknowledge(id, username) {
  const { rowCount } = await query(
    `UPDATE alerts
        SET acknowledged_at = now(), acknowledged_by = $2, updated_at = now()
      WHERE id = $1 AND acknowledged_at IS NULL`,
    [id, username],
  );
  return rowCount > 0;
}

/**
 * Device yang sudah offline melebihi `delaySeconds` (tapi masih terlihat
 * dalam 7 hari terakhir) dan belum punya alert offline terbuka.
 * Batas 7 hari mencegah banjir alert dari device lama yang memang dipensiunkan.
 */
export async function findDevicesNeedingOfflineAlert(delaySeconds) {
  const { rows } = await query(
    `SELECT d.id, d.pond_id, d.name, d.last_seen_at
       FROM devices d
      WHERE d.status = 'offline'
        AND d.last_seen_at < now() - ($1 || ' seconds')::interval
        AND d.last_seen_at > now() - interval '7 days'
        AND NOT EXISTS (
              SELECT 1 FROM alerts a
               WHERE a.device_id = d.id
                 AND a.type = 'device_offline'
                 AND a.resolved_at IS NULL)`,
    [delaySeconds],
  );
  return rows;
}
