import { createLogger } from '../utils/logger.js';

const log = createLogger('http');

/** Mencatat metode, path, status, dan durasi tiap request. */
export function requestLogger(req, res, next) {
  const startedAt = Date.now();
  res.on('finish', () => {
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
    log[level](`${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - startedAt}ms`);
  });
  next();
}
