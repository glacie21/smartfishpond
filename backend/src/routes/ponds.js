import { Router } from 'express';

import * as controller from '../controllers/pondController.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

export const pondRouter = Router();

// Membaca: semua user yang login. Mengubah: hanya admin.
const adminOnly = requireRole('admin');

pondRouter.get('/', asyncHandler(controller.list));
pondRouter.post(
  '/',
  adminOnly,
  validate(controller.createPondSchema),
  asyncHandler(controller.create),
);
pondRouter.get('/:id', asyncHandler(controller.detail));
pondRouter.get('/:id/overview', asyncHandler(controller.overview));
pondRouter.get('/:id/summary', asyncHandler(controller.summary));
pondRouter.patch(
  '/:id',
  adminOnly,
  validate(controller.updatePondSchema),
  asyncHandler(controller.update),
);
pondRouter.delete('/:id', adminOnly, asyncHandler(controller.remove));
