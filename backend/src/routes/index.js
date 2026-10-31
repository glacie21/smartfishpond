import { Router } from 'express';

import { requireAuth } from '../middleware/auth.js';
import { authRouter } from './auth.js';
import { deviceRouter } from './devices.js';
import { healthRouter } from './health.js';
import { pondRouter } from './ponds.js';
import { readingRouter } from './readings.js';

export const apiRouter = Router();

// Publik: health check untuk orkestrator, dan login.
apiRouter.use('/health', healthRouter);
apiRouter.use('/auth', authRouter);

// Semua route di bawah ini wajib login.
apiRouter.use(requireAuth);
apiRouter.use('/ponds', pondRouter);
apiRouter.use('/devices', deviceRouter);
apiRouter.use('/readings', readingRouter);
