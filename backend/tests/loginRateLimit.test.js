import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/repositories/userRepository.js', () => ({
  findByUsername: vi.fn(async () => null),
  touchLastLogin: vi.fn(),
  upsert: vi.fn(),
}));

const { createApp } = await import('../src/app.js');

describe('rate limit login', () => {
  it('memblokir setelah LOGIN_RATE_LIMIT_MAX percobaan gagal', async () => {
    const app = createApp();
    const attempt = () =>
      request(app).post('/api/auth/login').send({ username: 'admin', password: 'tebak' });

    // vitest.config.js: LOGIN_RATE_LIMIT_MAX=3
    for (let i = 0; i < 3; i++) {
      expect((await attempt()).status).toBe(401);
    }
    const blocked = await attempt();
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.message).toMatch(/percobaan login/);
  });
});
