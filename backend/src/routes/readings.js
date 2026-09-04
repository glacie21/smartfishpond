import { Router } from 'express';

import * as controller from '../controllers/readingController.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { validate } from '../middleware/validate.js';

export const readingRouter = Router();

readingRouter.get(
  '/',
  validate(controller.historyQuerySchema, 'query'),
  asyncHandler(controller.history),
);
readingRouter.get(
  '/aggregate',
  validate(controller.aggregateQuerySchema, 'query'),
  asyncHandler(controller.aggregate),
);
readingRouter.get('/latest/:deviceId', asyncHandler(controller.latest));
