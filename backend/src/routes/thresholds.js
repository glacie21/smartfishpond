import { Router } from 'express';

import * as controller from '../controllers/thresholdController.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

export const thresholdRouter = Router();

const adminOnly = requireRole('admin');

thresholdRouter.get('/', validate(controller.listQuerySchema, 'query'), asyncHandler(controller.list));
thresholdRouter.put(
  '/:metric',
  adminOnly,
  validate(controller.metricParamSchema, 'params'),
  validate(controller.setThresholdSchema),
  asyncHandler(controller.set),
);
thresholdRouter.delete(
  '/:metric',
  adminOnly,
  validate(controller.metricParamSchema, 'params'),
  validate(controller.resetQuerySchema, 'query'),
  asyncHandler(controller.reset),
);
