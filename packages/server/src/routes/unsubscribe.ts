import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../db/client.js';
import { success } from '../utils/response.js';
import { ValidationError } from '../utils/errors.js';

export const unsubscribeRouter = Router();

unsubscribeRouter.post('/unsubscribe', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, project_id, type } = req.body;
    if (!email || !project_id || !type) {
      throw new ValidationError('email, project_id, and type are required');
    }
    if (!['status_updates', 'weekly_digest', 'all'].includes(type)) {
      throw new ValidationError('type must be status_updates, weekly_digest, or all');
    }

    const data: Record<string, boolean> = {};
    if (type === 'status_updates' || type === 'all') data.status_updates = false;
    if (type === 'weekly_digest' || type === 'all') data.weekly_digest = false;

    await prisma.notificationPreference.upsert({
      where: { email_project_id: { email, project_id } },
      create: { email, project_id, ...data },
      update: data,
    });

    success(res, { unsubscribed: true });
  } catch (err) {
    next(err);
  }
});
