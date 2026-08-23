import { prisma } from '../db/client.js';
import { NotFoundError } from '../utils/errors.js';

export async function getOrgProjectIds(orgId: string): Promise<string[]> {
  const projects = await prisma.project.findMany({
    where: { org_id: orgId },
    select: { id: true },
  });
  return projects.map((p) => p.id);
}

export async function assertProjectInOrg(orgId: string, projectId: string): Promise<void> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, org_id: orgId },
    select: { id: true },
  });
  if (!project) throw new NotFoundError('项目不存在');
}

export async function assertFeedbackInOrg(orgId: string, feedbackId: string): Promise<void> {
  const feedback = await prisma.feedback.findUnique({
    where: { id: feedbackId },
    select: { project: { select: { org_id: true } } },
  });
  if (!feedback || feedback.project.org_id !== orgId) {
    throw new NotFoundError('反馈不存在');
  }
}

export async function assertFeedbackIdsInOrg(orgId: string, feedbackIds: string[]): Promise<void> {
  const owned = await prisma.feedback.findMany({
    where: { id: { in: feedbackIds }, project: { org_id: orgId } },
    select: { id: true },
  });
  if (owned.length !== feedbackIds.length) {
    throw new NotFoundError('反馈不存在');
  }
}

export type OrgScopedFeedbackRef = { orgId: string };
