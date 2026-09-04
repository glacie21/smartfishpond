import { Router } from 'express';

import * as controller from '../controllers/deviceController.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

export const deviceRouter = Router();

deviceRouter.get('/', asyncHandler(controller.list));
deviceRouter.get('/:id', asyncHandler(controller.detail));
