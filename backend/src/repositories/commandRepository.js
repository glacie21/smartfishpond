import { query } from '../db/pool.js';

export async function create({ deviceId, actuator, state, durationS, requestedBy }) {
  const { rows } = await query(
    `INSERT INTO device_commands (device_id, actuator, state, duration_s, requested_by)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [deviceId, actuator, state, durationS ?? null, requestedBy],
  );
  return rows[0];
}

export async function findByDevice(deviceId, limit = 20) {
  const { rows } = await query(
    `SELECT * FROM device_commands
      WHERE device_id = $1
      ORDER BY created_at DESC
      LIMIT $2`,
    [deviceId, limit],
  );
  return rows;
}

/**
 * Mencatat balasan device. Hanya perintah yang masih 'sent' yang diubah,
 * dan device_id harus cocok agar device tidak bisa menutup perintah milik
 * device lain.
 */
export async function markAcked(id, deviceId, { ok, error }) {
  const { rows } = await query(
    `UPDATE device_commands
        SET status = $3, error = $4, acked_at = now()
      WHERE id = $1 AND device_id = $2 AND status = 'sent'
      RETURNING *`,
    [id, deviceId, ok ? 'done' : 'failed', error ?? null],
  );
  return rows[0] ?? null;
}

export async function markFailed(id, error) {
  const { rows } = await query(
    `UPDATE device_commands SET status = 'failed', error = $2 WHERE id = $1 RETURNING *`,
    [id, error],
  );
  return rows[0] ?? null;
}

/** Perintah tanpa balasan melewati batas waktu -> 'timeout'. */
export async function expirePending(timeoutSeconds) {
  const { rows } = await query(
    `UPDATE device_commands c
        SET status = 'timeout'
       FROM devices d
      WHERE d.id = c.device_id
        AND c.status = 'sent'
        AND c.created_at < now() - ($1 || ' seconds')::interval
      RETURNING c.*, d.pond_id`,
    [timeoutSeconds],
  );
  return rows;
}
