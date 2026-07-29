import { prisma } from '../db/client.js';
import { NotFoundError, ValidationError, ConflictError } from '../utils/errors.js';
import { fireWebhooks } from './webhook.js';

export async function mergeFeedback(sourceId: string, targetId: string) {
  if (sourceId === targetId) {
    throw new ValidationError('不能将反馈合并到自身');
  }

  const result = await prisma.$transaction(async (tx) => {
    const [source, target] = await Promise.all([
      tx.feedback.findUnique({ where: { id: sourceId } }),
      tx.feedback.findUnique({ where: { id: targetId } }),
    ]);

    if (!source) throw new NotFoundError('源反馈不存在');
    if (!target) throw new NotFoundError('目标反馈不存在');
    if (source.project_id !== target.project_id) {
      throw new ValidationError('只能合并同一项目内的反馈');
    }
    if (source.merged_into_id) {
      throw new ConflictError('该反馈已被合并');
    }

    const [sourceVotes, targetVotes] = await Promise.all([
      tx.vote.findMany({ where: { feedback_id: sourceId } }),
      tx.vote.findMany({ where: { feedback_id: targetId }, select: { email: true } }),
    ]);

    const targetEmails = new Set(targetVotes.map((v) => v.email));
    const duplicateVoteIds: string[] = [];
    const transferVoteIds: string[] = [];

    for (const vote of sourceVotes) {
      if (targetEmails.has(vote.email)) {
        duplicateVoteIds.push(vote.id);
      } else {
        transferVoteIds.push(vote.id);
      }
    }

    if (duplicateVoteIds.length > 0) {
      await tx.vote.deleteMany({ where: { id: { in: duplicateVoteIds } } });
    }
    if (transferVoteIds.length > 0) {
      await tx.vote.updateMany({
        where: { id: { in: transferVoteIds } },
        data: { feedback_id: targetId },
      });
    }

    const newVoteCount = target.vote_count + transferVoteIds.length;
    await tx.feedback.update({
      where: { id: targetId },
      data: { vote_count: newVoteCount },
    });
    await tx.feedback.update({
      where: { id: sourceId },
      data: { merged_into_id: targetId, status: 'closed' },
    });

    return target;
  });

  fireWebhooks(result.project_id, 'feedback.merged', {
    source_id: sourceId,
    target_id: targetId,
  }).catch(() => {});

  return result;
}

export async function previewMerge(sourceId: string, targetId: string) {
  if (sourceId === targetId) {
    throw new ValidationError('不能将反馈合并到自身');
  }

  const [source, target] = await Promise.all([
    prisma.feedback.findUnique({
      where: { id: sourceId },
      select: { id: true, title: true, merged_into_id: true, project_id: true },
    }),
    prisma.feedback.findUnique({
      where: { id: targetId },
      select: { id: true, title: true, project_id: true },
    }),
  ]);

  if (!source) throw new NotFoundError('源反馈不存在');
  if (!target) throw new NotFoundError('目标反馈不存在');
  if (source.project_id !== target.project_id) {
    throw new ValidationError('只能合并同一项目内的反馈');
  }

  const [sourceVotes, targetVotes] = await Promise.all([
    prisma.vote.findMany({ where: { feedback_id: sourceId }, select: { email: true } }),
    prisma.vote.findMany({ where: { feedback_id: targetId }, select: { email: true } }),
  ]);

  const targetEmails = new Set(targetVotes.map((v) => v.email));
  const toTransfer = sourceVotes.filter((v) => !targetEmails.has(v.email));
  const toDeduplicate = sourceVotes.filter((v) => targetEmails.has(v.email));

  return {
    source_id: sourceId,
    target_id: targetId,
    source_title: source.title,
    target_title: target.title,
    votes_to_transfer: toTransfer.length,
    votes_to_deduplicate: toDeduplicate.length,
  };
}
