import { prisma } from '../db/client.js';
import { NotFoundError } from '../utils/errors.js';
import { fireWebhooks } from './webhook.js';

export async function addComment(
  feedbackId: string,
  email: string,
  name: string | undefined,
  content: string,
) {
  const feedback = await prisma.feedback.findUnique({ where: { id: feedbackId } });
  if (!feedback) throw new NotFoundError('反馈不存在');
  const comment = await prisma.comment.create({
    data: {
      feedback_id: feedbackId,
      author_email: email,
      author_name: name,
      content,
    },
  });

  fireWebhooks(feedback.project_id, 'comment.created', {
    feedback_id: feedbackId,
    comment_id: comment.id,
    author_email: email,
  }).catch(() => {});

  return comment;
}

export async function listComments(feedbackId: string) {
  return prisma.comment.findMany({
    where: { feedback_id: feedbackId },
    orderBy: { created_at: 'asc' },
  });
}

export async function deleteComment(commentId: string) {
  const comment = await prisma.comment.findUnique({ where: { id: commentId } });
  if (!comment) throw new NotFoundError('评论不存在');
  await prisma.comment.delete({ where: { id: commentId } });
}
