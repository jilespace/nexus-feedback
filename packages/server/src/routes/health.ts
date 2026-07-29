import { Router } from 'express';
import { prisma } from '../db/client.js';
import { success } from '../utils/response.js';

export const healthRouter = Router();

healthRouter.get('/health', async (_req, res, next) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    success(res, { status: 'ok', database: 'ok', storage: 'ok' });
  } catch (err) {
    next(err);
  }
});
