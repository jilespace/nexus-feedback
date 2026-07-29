import type { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { prisma } from '../db/client.js';
import { env } from '../config/index.js';
import { AuthError } from '../utils/errors.js';

function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

export async function projectApiKeyAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey || typeof apiKey !== 'string') {
      return next(new AuthError(40100, '缺少 API Key'));
    }

    const hash = hashApiKey(apiKey);
    const project = await prisma.project.findUnique({ where: { api_key_hash: hash } });
    if (!project) {
      return next(new AuthError(40101, '无效的 API Key'));
    }

    req.projectId = project.id;
    req.project = project;
    next();
  } catch (error) {
    next(error);
  }
}

export function adminAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return next(new AuthError(40110, '缺少认证令牌'));
  }

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as { sub: string };
    req.adminId = payload.sub;
    next();
  } catch {
    next(new AuthError(40110, '认证令牌无效或已过期'));
  }
}
