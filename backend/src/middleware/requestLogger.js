import { createLogger } from '../utils/logger.js';

const log = createLogger('http');

// Dipanggil healthcheck container / Prometheus tiap beberapa detik.
const QUIET_PATHS = new Set(['/api/health', '/metrics']);

/** Mencatat metode, path, status, dan durasi tiap request. */
export function requestLogger(req, res, next) {
  const startedAt = Date.now();
  res.on('finish', () => {
    const ok = res.statusCode < 400;
    const level = res.statusCode >= 500 ? 'error' : !ok ? 'warn' : QUIET_PATHS.has(req.path) ? 'debug' : 'info';
    log[level](`${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - startedAt}ms`);
  });
  next();
}
