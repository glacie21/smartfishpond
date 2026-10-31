import { z } from 'zod';

import * as alertService from '../services/alertService.js';

export const listQuerySchema = z.object({
  status: z.enum(['open', 'resolved', 'all']).default('all'),
  pondId: z.string().min(1).max(64).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
});

export const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export async function list(req, res) {
  res.json({ data: await alertService.listAlerts(req.validated.query) });
}

export async function acknowledge(req, res) {
  const alert = await alertService.acknowledgeAlert(req.validated.params.id, req.user.username);
  res.json({ data: alert });
}
