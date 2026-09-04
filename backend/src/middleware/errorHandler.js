import { config } from '../config/index.js';
import { HttpError } from '../utils/errors.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('error');

/** Handler 404 untuk route yang tidak terdaftar. */
export function notFoundHandler(req, res) {
  res.status(404).json({
    error: { message: `Endpoint ${req.method} ${req.originalUrl} tidak ditemukan` },
  });
}

/**
 * Error handler terpusat. Harus dipasang paling akhir dan tetap
 * memiliki 4 parameter agar dikenali Express.
 */
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  const status = err instanceof HttpError ? err.status : 500;

  if (status >= 500) {
    log.error(`${req.method} ${req.originalUrl}: ${err.message}`, err.stack);
  }

  res.status(status).json({
    error: {
      message: status >= 500 && config.isProduction ? 'Terjadi kesalahan pada server' : err.message,
      details: err.details,
      // Stack hanya dibuka saat development agar tidak bocor ke publik.
      ...(config.isProduction ? {} : { stack: err.stack }),
    },
  });
}
