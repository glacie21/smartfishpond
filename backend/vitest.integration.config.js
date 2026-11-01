import { defineConfig } from 'vitest/config';

/**
 * Test integrasi terhadap PostgreSQL sungguhan.
 *
 *   TEST_DATABASE_URL=postgres://fishpond:fishpond@localhost:5432/smartfishpond_test \
 *     npm run test:integration
 *
 * PERINGATAN: skema `public` di database itu DIHAPUS dan dibuat ulang setiap
 * file test. Jangan arahkan ke database yang berisi data penting.
 */
const testDatabaseUrl = process.env.TEST_DATABASE_URL;

export default defineConfig({
  test: {
    include: ['tests/integration/**/*.test.js'],
    setupFiles: ['tests/integration/setup.js'],
    // Semua file berbagi satu database: jalankan bergantian.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
    env: {
      NODE_ENV: 'test',
      LOG_LEVEL: 'error',
      DATABASE_URL: testDatabaseUrl ?? '',
      PG_POOL_MAX: process.env.PG_POOL_MAX ?? '4',
      JWT_SECRET: 'test-secret-yang-cukup-panjang-untuk-hs256-0123456789',
      BCRYPT_ROUNDS: '4',
      ALERT_CONFIRM_READINGS: '2',
    },
  },
});
