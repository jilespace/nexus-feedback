import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../db/client.js';
import { success } from '../utils/response.js';
import { ValidationError, NotFoundError } from '../utils/errors.js';
import { orgAuth, requireRole } from '../middleware/orgAuth.js';

export const ssoRouter = Router();

ssoRouter.use(orgAuth);
ssoRouter.use(requireRole(['owner', 'admin']));

ssoRouter.get('/projects/:projectId/sso', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projectId = req.params.projectId as string;
    const config = await prisma.sSOConfig.findUnique({
      where: { project_id: projectId },
    });
    if (!config) throw new NotFoundError('SSO 配置不存在');
    success(res, {
      id: config.id,
      project_id: config.project_id,
      user_id_claim: config.user_id_claim,
      email_claim: config.email_claim,
      name_claim: config.name_claim,
      enabled: config.enabled,
      created_at: config.created_at.toISOString(),
      updated_at: config.updated_at.toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

ssoRouter.put('/projects/:projectId/sso', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projectId = req.params.projectId as string;
    const { jwt_secret, user_id_claim, email_claim, name_claim, enabled } = req.body;
    if (!jwt_secret) throw new ValidationError('jwt_secret 不能为空');
    const config = await prisma.sSOConfig.upsert({
      where: { project_id: projectId },
      create: {
        project_id: projectId,
        jwt_secret,
        user_id_claim: user_id_claim ?? 'sub',
        email_claim: email_claim ?? 'email',
        name_claim: name_claim ?? 'name',
        enabled: enabled ?? false,
      },
      update: {
        jwt_secret,
        ...(user_id_claim !== undefined && { user_id_claim }),
        ...(email_claim !== undefined && { email_claim }),
        ...(name_claim !== undefined && { name_claim }),
        ...(enabled !== undefined && { enabled }),
      },
    });
    success(res, { id: config.id, project_id: config.project_id, enabled: config.enabled });
  } catch (err) {
    next(err);
  }
});

ssoRouter.delete('/projects/:projectId/sso', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projectId = req.params.projectId as string;
    const existing = await prisma.sSOConfig.findUnique({
      where: { project_id: projectId },
    });
    if (!existing) throw new NotFoundError('SSO 配置不存在');
    await prisma.sSOConfig.delete({ where: { project_id: projectId } });
    success(res, { deleted: true });
  } catch (err) {
    next(err);
  }
});
