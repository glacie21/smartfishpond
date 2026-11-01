import cors from 'cors';
import express from 'express';
import helmet from 'helmet';

import { config } from './config/index.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { apiLimiter } from './middleware/rateLimit.js';
import { requestLogger } from './middleware/requestLogger.js';
import { httpMetricsMiddleware } from './observability/metrics.js';
import { apiRouter } from './routes/index.js';
import { metricsRouter } from './routes/metrics.js';

/** Membuat instance Express — dipisah dari index.js agar mudah diuji. */
export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  // Di belakang reverse proxy, req.ip harus IP klien asli agar rate limit
  // tidak menghitung semua pengguna sebagai satu IP (milik proxy).
  app.set('trust proxy', config.trustProxy);
  app.use(helmet());
  app.use(cors({ origin: config.cors.origin }));
  app.use(express.json({ limit: '256kb' }));
  app.use(requestLogger);
  app.use(httpMetricsMiddleware);

  app.get('/', (_req, res) => {
    res.json({
      name: 'Smart Fish Pond IoT API',
      version: '0.1.0',
      docs: '/api/health',
    });
  });

  // Di luar /api: tidak terkena rate limit maupun login JWT (punya token sendiri).
  app.use('/metrics', metricsRouter);
  app.use('/api', apiLimiter, apiRouter);

  // Urutan wajib: 404 dulu, error handler paling akhir.
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
