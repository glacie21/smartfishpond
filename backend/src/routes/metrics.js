import { timingSafeEqual } from 'node:crypto';

import { Router } from 'express';

import { config } from '../config/index.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { registry } from '../observability/metrics.js';

export const metricsRouter = Router();

function tokenMatches(header) {
  const expected = Buffer.from(`Bearer ${config.metrics.token}`);
  const actual = Buffer.from(header ?? '');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/**
 * Endpoint scrape Prometheus. Nonaktif (404) bila METRICS_TOKEN kosong,
 * agar jumlah device/alert tidak terbuka ke publik tanpa sengaja.
 */
metricsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    if (!config.metrics.token) {
      res.status(404).json({ error: { message: 'Metrik nonaktif (METRICS_TOKEN kosong)' } });
      return;
    }
    if (!tokenMatches(req.get('authorization'))) {
      res.status(401).json({ error: { message: 'Token metrik tidak valid' } });
      return;
    }
    res.set('Content-Type', registry.contentType);
    res.send(await registry.metrics());
  }),
);
