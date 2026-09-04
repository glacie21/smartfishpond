import { Router } from 'express';

import { pool } from '../db/pool.js';
import { getMqttClient } from '../mqtt/client.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

export const healthRouter = Router();

/** Liveness + kesiapan dependensi (database & broker). */
healthRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    let database = 'up';
    try {
      await pool.query('SELECT 1');
    } catch {
      database = 'down';
    }

    const mqttClient = getMqttClient();
    const broker = mqttClient?.connected ? 'up' : 'down';
    const status = database === 'up' ? 'ok' : 'degraded';

    res.status(status === 'ok' ? 200 : 503).json({
      status,
      uptime: Math.round(process.uptime()),
      dependencies: { database, broker },
      timestamp: new Date().toISOString(),
    });
  }),
);
