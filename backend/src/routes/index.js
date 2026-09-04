import { Router } from 'express';

import { deviceRouter } from './devices.js';
import { healthRouter } from './health.js';
import { pondRouter } from './ponds.js';
import { readingRouter } from './readings.js';

export const apiRouter = Router();

apiRouter.use('/health', healthRouter);
apiRouter.use('/ponds', pondRouter);
apiRouter.use('/devices', deviceRouter);
apiRouter.use('/readings', readingRouter);
