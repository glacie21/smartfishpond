import rateLimit from 'express-rate-limit';

import { config } from '../config/index.js';

/** Respons 429 memakai format error yang sama dengan endpoint lain. */
function handler(_req, res, _next, options) {
  res.status(options.statusCode).json({ error: { message: options.message } });
}

const common = {
  windowMs: config.rateLimit.windowMs,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler,
};

/** Batas umum per IP untuk seluruh /api. */
export const apiLimiter = rateLimit({
  ...common,
  limit: config.rateLimit.max,
  message: 'Terlalu banyak request, coba lagi beberapa saat lagi',
});

/**
 * Batas ketat untuk login guna menahan brute force password.
 * Login yang berhasil tidak dihitung.
 */
export const loginLimiter = rateLimit({
  ...common,
  limit: config.rateLimit.loginMax,
  skipSuccessfulRequests: true,
  message: 'Terlalu banyak percobaan login gagal, coba lagi dalam 15 menit',
});
