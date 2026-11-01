/**
 * Dijalankan sebelum tiap file test integrasi: skema dikosongkan lalu semua
 * migrasi dijalankan dari awal, sehingga setiap file mulai dari database bersih
 * dan rangkaian migrasi 001..N ikut teruji.
 */
import { afterAll } from 'vitest';

if (!process.env.TEST_DATABASE_URL) {
  throw new Error(
    'TEST_DATABASE_URL belum diisi. Contoh:\n' +
      '  TEST_DATABASE_URL=postgres://fishpond:fishpond@localhost:5432/smartfishpond_test npm run test:integration',
  );
}

const { closePool, pool } = await import('../../src/db/pool.js');
const { runMigrations } = await import('../../src/db/migrate.js');

// Top-level await, bukan beforeAll: vitest 1.x menjalankan hook beforeAll
// secara paralel, sehingga beforeAll milik file test bisa mendahului migrasi.
await pool.query('DROP SCHEMA IF EXISTS public CASCADE');
await pool.query('CREATE SCHEMA public');
await runMigrations();

afterAll(async () => {
  await closePool();
});
