import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/index.js';
import { AuthError, ForbiddenError } from '../utils/errors.js';

export function orgAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return next(new AuthError(40100, '缺少认证令牌'));
  }

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] }) as {
      memberId: string;
      orgId: string;
      role: string;
      typ?: string;
    };
    if (payload.typ !== 'org') {
      return next(new AuthError(40110, '认证令牌类型无效'));
    }
    req.memberId = payload.memberId;
    req.orgId = payload.orgId;
    req.memberRole = payload.role;
    next();
  } catch {
    next(new AuthError(40110, '认证令牌无效或已过期'));
  }
}

export function requireRole(roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.memberRole || !roles.includes(req.memberRole)) {
      return next(new ForbiddenError('权限不足'));
    }
    next();
  };
}
