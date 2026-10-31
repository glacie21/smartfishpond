import { Router } from 'express';

import * as controller from '../controllers/alertController.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { validate } from '../middleware/validate.js';

export const alertRouter = Router();

alertRouter.get('/', validate(controller.listQuerySchema, 'query'), asyncHandler(controller.list));

// Semua user yang login boleh menandai alert sudah ditangani (operator jaga).
alertRouter.post(
  '/:id/acknowledge',
  validate(controller.idParamSchema, 'params'),
  asyncHandler(controller.acknowledge),
);
