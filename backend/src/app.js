import cors from 'cors';
import express from 'express';
import helmet from 'helmet';

import { config } from './config/index.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { requestLogger } from './middleware/requestLogger.js';
import { apiRouter } from './routes/index.js';

/** Membuat instance Express — dipisah dari index.js agar mudah diuji. */
export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: config.cors.origin }));
  app.use(express.json({ limit: '256kb' }));
  app.use(requestLogger);

  app.get('/', (_req, res) => {
    res.json({
      name: 'Smart Fish Pond IoT API',
      version: '0.1.0',
      docs: '/api/health',
    });
  });

  app.use('/api', apiRouter);

  // Urutan wajib: 404 dulu, error handler paling akhir.
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
