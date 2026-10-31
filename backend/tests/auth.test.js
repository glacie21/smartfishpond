import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/repositories/userRepository.js', () => ({
  findByUsername: vi.fn(),
  touchLastLogin: vi.fn(),
  upsert: vi.fn(),
}));
vi.mock('../src/services/pondService.js', () => ({
  listPonds: vi.fn(async () => []),
  deletePond: vi.fn(async () => undefined),
}));

const { createApp } = await import('../src/app.js');
const { signToken } = await import('../src/services/authService.js');
const userRepository = await import('../src/repositories/userRepository.js');
const pondService = await import('../src/services/pondService.js');

const app = createApp();
const adminToken = signToken({ id: 1, username: 'admin', role: 'admin' });
const viewerToken = signToken({ id: 2, username: 'pak-budi', role: 'viewer' });

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/auth/login', () => {
  const storedUser = {
    id: 1,
    username: 'admin',
    role: 'admin',
    password_hash: bcrypt.hashSync('rahasia-kolam', 4),
  };

  it('mengembalikan token untuk kredensial yang benar', async () => {
    userRepository.findByUsername.mockResolvedValue(storedUser);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'rahasia-kolam' });

    expect(res.status).toBe(200);
    expect(res.body.data.user).toEqual({ id: '1', username: 'admin', role: 'admin' });
    expect(res.body.data.user.password_hash).toBeUndefined();
    expect(jwt.decode(res.body.data.token)).toMatchObject({ sub: '1', role: 'admin' });
    expect(userRepository.touchLastLogin).toHaveBeenCalledWith(1);
  });

  it('menolak password salah dengan 401', async () => {
    userRepository.findByUsername.mockResolvedValue(storedUser);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'salah' });

    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe('Username atau password salah');
  });
});

describe('proteksi route', () => {
  it('menolak request tanpa token', async () => {
    const res = await request(app).get('/api/ponds');
    expect(res.status).toBe(401);
  });

  it('menolak token yang ditandatangani secret lain', async () => {
    const forged = jwt.sign({ username: 'admin', role: 'admin' }, 'secret-palsu', {
      subject: '1',
      issuer: 'smartfishpond',
    });
    const res = await request(app).get('/api/ponds').set('Authorization', `Bearer ${forged}`);
    expect(res.status).toBe(401);
  });

  it('menolak token kedaluwarsa dengan pesan yang jelas', async () => {
    const expired = jwt.sign(
      { username: 'admin', role: 'admin', exp: Math.floor(Date.now() / 1000) - 60 },
      process.env.JWT_SECRET,
      { subject: '1', issuer: 'smartfishpond' },
    );
    const res = await request(app).get('/api/ponds').set('Authorization', `Bearer ${expired}`);
    expect(res.status).toBe(401);
    expect(res.body.error.message).toMatch(/Sesi berakhir/);
  });

  it('mengizinkan viewer membaca data', async () => {
    const res = await request(app).get('/api/ponds').set('Authorization', `Bearer ${viewerToken}`);
    expect(res.status).toBe(200);
  });

  it('melarang viewer menghapus kolam', async () => {
    const res = await request(app)
      .delete('/api/ponds/pond-01')
      .set('Authorization', `Bearer ${viewerToken}`);
    expect(res.status).toBe(403);
    expect(pondService.deletePond).not.toHaveBeenCalled();
  });

  it('mengizinkan admin menghapus kolam', async () => {
    const res = await request(app)
      .delete('/api/ponds/pond-01')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(204);
    expect(pondService.deletePond).toHaveBeenCalledWith('pond-01');
  });

  it('GET /api/auth/me mengembalikan identitas pemilik token', async () => {
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${viewerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ id: '2', username: 'pak-budi', role: 'viewer' });
  });
});
