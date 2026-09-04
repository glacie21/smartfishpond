/**
 * Migration runner sederhana.
 *
 * Menjalankan setiap file .sql pada `migrations/` secara berurutan
 * (urut nama file) dan mencatatnya di tabel schema_migrations agar
 * tidak dijalankan dua kali. Setiap file dieksekusi dalam satu transaksi.
 *
 * Jalankan: npm run migrate
 */
import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { closePool, pool } from './pool.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('migrate');
const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), 'migrations');

async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name       TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}

async function appliedMigrations(client) {
  const { rows } = await client.query('SELECT name FROM schema_migrations');
  return new Set(rows.map((row) => row.name));
}

export async function runMigrations() {
  const client = await pool.connect();
  try {
    await ensureMigrationsTable(client);
    const applied = await appliedMigrations(client);

    const files = (await readdir(migrationsDir)).filter((f) => f.endsWith('.sql')).sort();
    const pending = files.filter((f) => !applied.has(f));

    if (pending.length === 0) {
      log.info('tidak ada migrasi baru');
      return;
    }

    for (const file of pending) {
      const sql = await readFile(join(migrationsDir, file), 'utf8');
      log.info(`menjalankan ${file}`);
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw new Error(`migrasi ${file} gagal: ${err.message}`, { cause: err });
      }
    }

    log.info(`${pending.length} migrasi selesai`);
  } finally {
    client.release();
  }
}

// Dijalankan langsung dari CLI, bukan saat di-import oleh modul lain.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runMigrations()
    .then(closePool)
    .catch(async (err) => {
      log.error(err.message);
      await closePool();
      process.exit(1);
    });
}
