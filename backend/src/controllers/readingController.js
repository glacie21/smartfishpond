import { z } from 'zod';

import * as readingService from '../services/readingService.js';

const isoDate = z.string().datetime({ offset: true }).optional();

export const historyQuerySchema = z.object({
  pondId: z.string().max(64).optional(),
  deviceId: z.string().max(64).optional(),
  from: isoDate,
  to: isoDate,
  limit: z.coerce.number().int().positive().max(5000).optional(),
});

export const aggregateQuerySchema = historyQuerySchema
  .omit({ limit: true })
  .extend({ bucket: z.string().max(20).optional() });

export async function history(req, res) {
  res.json({ data: await readingService.getHistory(req.validated.query) });
}

export async function aggregate(req, res) {
  res.json({ data: await readingService.getAggregated(req.validated.query) });
}

export async function latest(req, res) {
  res.json({ data: await readingService.getLatestByDevice(req.params.deviceId) });
}
