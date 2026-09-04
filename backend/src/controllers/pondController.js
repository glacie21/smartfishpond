import { z } from 'zod';

import * as pondService from '../services/pondService.js';

export const createPondSchema = z.object({
  id: z.string().min(1).max(64).regex(/^[a-zA-Z0-9_-]+$/, 'hanya huruf, angka, - dan _'),
  name: z.string().min(1).max(120),
  location: z.string().max(200).optional(),
  depthCm: z.number().positive().max(2000).optional(),
  fishType: z.string().max(120).optional(),
});

export const updatePondSchema = createPondSchema.partial().omit({ id: true });

export async function list(req, res) {
  res.json({ data: await pondService.listPonds() });
}

export async function detail(req, res) {
  res.json({ data: await pondService.getPond(req.params.id) });
}

export async function overview(req, res) {
  res.json({ data: await pondService.getPondOverview(req.params.id) });
}

export async function summary(req, res) {
  const { from, to } = req.query;
  res.json({ data: await pondService.getPondSummary(req.params.id, { from, to }) });
}

export async function create(req, res) {
  const pond = await pondService.createPond(req.validated.body);
  res.status(201).json({ data: pond });
}

export async function update(req, res) {
  res.json({ data: await pondService.updatePond(req.params.id, req.validated.body) });
}

export async function remove(req, res) {
  await pondService.deletePond(req.params.id);
  res.status(204).end();
}
