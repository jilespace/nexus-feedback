import { prisma } from '../db/client.js';
import { NotFoundError, ForbiddenError, ValidationError } from '../utils/errors.js';
import { paginatedResult } from '../utils/pagination.js';

export async function addNote(feedbackId: string, memberId: string, content: string) {
  if (!content || !content.trim()) {
    throw new ValidationError('备注内容不能为空');
  }

  const feedback = await prisma.feedback.findUnique({ where: { id: feedbackId } });
  if (!feedback) throw new NotFoundError('反馈不存在');

  const note = await prisma.internalNote.create({
    data: {
      feedback_id: feedbackId,
      member_id: memberId,
      content: content.trim(),
    },
    include: {
      member: { select: { id: true, display_name: true, email: true } },
    },
  });

  return note;
}

export async function listNotes(
  feedbackId: string,
  pagination?: { page: number; pageSize: number; skip: number; take: number },
) {
  const feedback = await prisma.feedback.findUnique({ where: { id: feedbackId } });
  if (!feedback) throw new NotFoundError('反馈不存在');

  const [items, total] = await Promise.all([
    prisma.internalNote.findMany({
      where: { feedback_id: feedbackId },
      orderBy: { created_at: 'desc' },
      skip: pagination?.skip,
      take: pagination?.take,
      include: {
        member: { select: { id: true, display_name: true, email: true } },
      },
    }),
    prisma.internalNote.count({ where: { feedback_id: feedbackId } }),
  ]);

  return paginatedResult(items, total, pagination?.page ?? 1, pagination?.pageSize ?? 20);
}

export async function deleteNote(noteId: string, memberId: string) {
  const note = await prisma.internalNote.findUnique({ where: { id: noteId } });
  if (!note) throw new NotFoundError('备注不存在');
  if (note.member_id !== memberId) {
    throw new ForbiddenError('只能删除自己的备注');
  }

  await prisma.internalNote.delete({ where: { id: noteId } });
  return { deleted: true };
}
