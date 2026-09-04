import { Router } from 'express';

import * as controller from '../controllers/pondController.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { validate } from '../middleware/validate.js';

export const pondRouter = Router();

pondRouter.get('/', asyncHandler(controller.list));
pondRouter.post(
  '/',
  validate(controller.createPondSchema),
  asyncHandler(controller.create),
);
pondRouter.get('/:id', asyncHandler(controller.detail));
pondRouter.get('/:id/overview', asyncHandler(controller.overview));
pondRouter.get('/:id/summary', asyncHandler(controller.summary));
pondRouter.patch(
  '/:id',
  validate(controller.updatePondSchema),
  asyncHandler(controller.update),
);
pondRouter.delete('/:id', asyncHandler(controller.remove));
