import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Config backend membaca env saat di-import; test tidak menyentuh DB sungguhan.
    env: {
      NODE_ENV: 'test',
      LOG_LEVEL: 'error',
      DATABASE_URL: 'postgres://test:test@127.0.0.1:1/test',
      JWT_SECRET: 'test-secret-yang-cukup-panjang-untuk-hs256-0123456789',
      BCRYPT_ROUNDS: '4',
      LOGIN_RATE_LIMIT_MAX: '3',
    },
  },
});
