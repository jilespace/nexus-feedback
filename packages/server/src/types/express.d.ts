import type { Project } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      adminId?: string;
      memberId?: string;
      orgId?: string;
      memberRole?: string;
      projectId?: string;
      project?: Project;
      ssoUser?: { email: string; name?: string; userId?: string };
    }
  }
}

export {};
