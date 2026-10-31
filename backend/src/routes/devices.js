import { Router } from 'express';

import * as controller from '../controllers/deviceController.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

export const deviceRouter = Router();

// Membaca: semua user yang login. Mengubah & mengendalikan: hanya admin.
const adminOnly = requireRole('admin');

deviceRouter.get('/', asyncHandler(controller.list));
deviceRouter.post(
  '/',
  adminOnly,
  validate(controller.createDeviceSchema),
  asyncHandler(controller.create),
);
deviceRouter.get('/:id', asyncHandler(controller.detail));
deviceRouter.patch(
  '/:id',
  adminOnly,
  validate(controller.updateDeviceSchema),
  asyncHandler(controller.update),
);
deviceRouter.delete('/:id', adminOnly, asyncHandler(controller.remove));

deviceRouter.get(
  '/:id/commands',
  validate(controller.commandListQuerySchema, 'query'),
  asyncHandler(controller.listCommands),
);
deviceRouter.post(
  '/:id/commands',
  adminOnly,
  validate(controller.commandSchema),
  asyncHandler(controller.sendCommand),
);
