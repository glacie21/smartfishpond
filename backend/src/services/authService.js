import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

import { config } from '../config/index.js';
import * as userRepository from '../repositories/userRepository.js';
import { unauthorized } from '../utils/errors.js';

export const ROLES = ['admin', 'viewer'];

const JWT_ISSUER = 'smartfishpond';
const JWT_ALGORITHM = 'HS256';

// Dibandingkan saat username tidak ada, supaya waktu respons sama dengan
// password salah dan penyerang tidak bisa menebak username yang terdaftar.
const DUMMY_HASH = bcrypt.hashSync('dummy-password-untuk-timing', 10);

export function hashPassword(password) {
  return bcrypt.hash(password, config.auth.bcryptRounds);
}

/** Data user yang aman dikirim ke klien (tanpa hash password). */
function toPublicUser(user) {
  return { id: String(user.id), username: user.username, role: user.role };
}

export function signToken(user) {
  const { id, username, role } = toPublicUser(user);
  return jwt.sign({ username, role }, config.auth.jwtSecret, {
    subject: id,
    issuer: JWT_ISSUER,
    algorithm: JWT_ALGORITHM,
    expiresIn: config.auth.jwtExpiresIn,
  });
}

/**
 * Memverifikasi JWT dan mengembalikan identitas pemiliknya.
 * @returns {{id: string, username: string, role: string, exp: number}}
 */
export function verifyToken(token) {
  if (!token) throw unauthorized();
  try {
    const payload = jwt.verify(token, config.auth.jwtSecret, {
      issuer: JWT_ISSUER,
      algorithms: [JWT_ALGORITHM],
    });
    return { id: payload.sub, username: payload.username, role: payload.role, exp: payload.exp };
  } catch (err) {
    throw unauthorized(
      err.name === 'TokenExpiredError' ? 'Sesi berakhir, silakan login ulang' : 'Token akses tidak valid',
    );
  }
}

export async function login(username, password) {
  const user = await userRepository.findByUsername(username);
  const valid = await bcrypt.compare(password, user?.password_hash ?? DUMMY_HASH);
  if (!user || !valid) {
    throw unauthorized('Username atau password salah');
  }

  await userRepository.touchLastLogin(user.id);
  return { token: signToken(user), user: toPublicUser(user) };
}

/** Dipakai CLI `scripts/create-user.js`. */
export async function createOrUpdateUser({ username, password, role }) {
  return userRepository.upsert({ username, passwordHash: await hashPassword(password), role });
}
