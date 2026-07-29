import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../db/client.js';

export async function ssoAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const token = req.headers['x-sso-token'] as string | undefined;
  if (!token) return next();

  const project = req.project;
  if (!project) return next();

  try {
    const config = await prisma.sSOConfig.findUnique({
      where: { project_id: project.id },
    });
    if (!config || !config.enabled) return next();

    const payload = jwt.verify(token, config.jwt_secret) as Record<string, unknown>;
    req.ssoUser = {
      email: String(payload[config.email_claim] ?? ''),
      name: payload[config.name_claim] ? String(payload[config.name_claim]) : undefined,
      userId: payload[config.user_id_claim] ? String(payload[config.user_id_claim]) : undefined,
    };
    next();
  } catch {
    // SSO is optional — invalid token just means no SSO user
    next();
  }
}
