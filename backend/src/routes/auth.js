import { Router } from 'express';

import * as controller from '../controllers/authController.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';
import { loginLimiter } from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';

export const authRouter = Router();

authRouter.post(
  '/login',
  loginLimiter,
  validate(controller.loginSchema),
  asyncHandler(controller.login),
);
authRouter.get('/me', requireAuth, asyncHandler(controller.me));
