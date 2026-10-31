import { query } from '../db/pool.js';

/** Username disimpan huruf kecil agar login tidak peka huruf besar/kecil. */
const normalize = (username) => username.trim().toLowerCase();

export async function findByUsername(username) {
  const { rows } = await query('SELECT * FROM users WHERE username = $1', [normalize(username)]);
  return rows[0] ?? null;
}

/** Membuat user baru, atau mengganti password & peran bila sudah ada. */
export async function upsert({ username, passwordHash, role }) {
  const { rows } = await query(
    `INSERT INTO users (username, password_hash, role)
     VALUES ($1, $2, $3)
     ON CONFLICT (username) DO UPDATE
       SET password_hash = EXCLUDED.password_hash,
           role          = EXCLUDED.role
     RETURNING id, username, role, created_at`,
    [normalize(username), passwordHash, role],
  );
  return rows[0];
}

export async function touchLastLogin(id) {
  await query('UPDATE users SET last_login_at = now() WHERE id = $1', [id]);
}
