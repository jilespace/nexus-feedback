import { prisma } from '../db/client.js';
import { NotFoundError, ConflictError } from '../utils/errors.js';

async function findFeedback(feedbackId: string, projectId?: string) {
  return projectId
    ? prisma.feedback.findFirst({ where: { id: feedbackId, project_id: projectId } })
    : prisma.feedback.findUnique({ where: { id: feedbackId } });
}

export async function addVote(feedbackId: string, email: string, projectId?: string) {
  const feedback = await findFeedback(feedbackId, projectId);
  if (!feedback) throw new NotFoundError('反馈不存在');

  const existing = await prisma.vote.findUnique({
    where: { email_feedback_id: { email, feedback_id: feedbackId } },
  });
  if (existing) throw new ConflictError('您已经投过票了');

  const [vote] = await prisma.$transaction([
    prisma.vote.create({ data: { email, feedback_id: feedbackId } }),
    prisma.feedback.update({
      where: { id: feedbackId },
      data: { vote_count: { increment: 1 } },
    }),
  ]);

  return { id: vote.id, email: vote.email, feedback_id: vote.feedback_id };
}

export async function removeVote(feedbackId: string, email: string, projectId?: string) {
  const feedback = await findFeedback(feedbackId, projectId);
  if (!feedback) throw new NotFoundError('反馈不存在');

  const vote = await prisma.vote.findUnique({
    where: { email_feedback_id: { email, feedback_id: feedbackId } },
  });
  if (!vote) throw new NotFoundError('投票记录不存在');

  await prisma.$transaction([
    prisma.vote.delete({ where: { id: vote.id } }),
    prisma.feedback.update({
      where: { id: feedbackId },
      data: { vote_count: { decrement: 1 } },
    }),
  ]);

  return { id: vote.id };
}

export async function hasVoted(feedbackId: string, email: string, projectId?: string) {
  const feedback = await findFeedback(feedbackId, projectId);
  if (!feedback) throw new NotFoundError('反馈不存在');

  const vote = await prisma.vote.findUnique({
    where: { email_feedback_id: { email, feedback_id: feedbackId } },
  });
  return !!vote;
}

export async function getVoters(feedbackId: string) {
  const votes = await prisma.vote.findMany({
    where: { feedback_id: feedbackId },
    select: { email: true, created_at: true },
    orderBy: { created_at: 'desc' },
  });
  return votes.map((v) => v.email);
}
