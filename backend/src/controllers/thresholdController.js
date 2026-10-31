import { z } from 'zod';

import { METRIC_KEYS } from '../services/metrics.js';
import * as thresholdService from '../services/thresholdService.js';

const pondIdSchema = z.string().min(1).max(64);

export const metricParamSchema = z.object({
  metric: z.enum(METRIC_KEYS),
});

export const listQuerySchema = z.object({
  pondId: pondIdSchema.optional(),
});

export const setThresholdSchema = z
  .object({
    // Kosong/null = mengubah default untuk semua kolam.
    pondId: pondIdSchema.nullable().optional(),
    min: z.number().finite(),
    max: z.number().finite(),
  })
  .refine((body) => body.min < body.max, { message: 'min harus lebih kecil dari max' });

export const resetQuerySchema = z.object({
  pondId: pondIdSchema,
});

export async function list(req, res) {
  res.json({ data: await thresholdService.getEffective(req.validated.query.pondId) });
}

export async function set(req, res) {
  const { metric } = req.validated.params;
  await thresholdService.setThreshold(metric, req.validated.body);
  res.json({ data: await thresholdService.getEffective(req.validated.body.pondId) });
}

export async function reset(req, res) {
  const { metric } = req.validated.params;
  const { pondId } = req.validated.query;
  await thresholdService.resetThreshold(metric, pondId);
  res.json({ data: await thresholdService.getEffective(pondId) });
}
