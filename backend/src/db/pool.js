import pg from 'pg';

import { config } from '../config/index.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('db');

// PostgreSQL mengembalikan NUMERIC sebagai string demi presisi.
// Kolom metrik kita cukup aman sebagai float, jadi di-parse agar JSON rapi.
pg.types.setTypeParser(pg.types.builtins.NUMERIC, (value) =>
  value === null ? null : Number.parseFloat(value),
);

export const pool = new pg.Pool({
  connectionString: config.db.connectionString,
  max: config.db.poolMax,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

pool.on('error', (err) => {
  log.error('koneksi pool bermasalah', err.message);
});

/** Shortcut query; mencatat query lambat agar mudah ditelusuri. */
export async function query(text, params) {
  const startedAt = Date.now();
  const result = await pool.query(text, params);
  const durationMs = Date.now() - startedAt;
  if (durationMs > 300) {
    log.warn(`query lambat (${durationMs} ms): ${text.split('\n')[0].trim()}`);
  }
  return result;
}

/** Menjalankan beberapa query dalam satu transaksi. */
export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function closePool() {
  await pool.end();
  log.info('pool koneksi ditutup');
}
