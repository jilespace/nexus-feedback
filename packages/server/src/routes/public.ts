import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../db/client.js';
import { success } from '../utils/response.js';
import { NotFoundError, ValidationError, isValidEmail } from '../utils/errors.js';
import { addComment } from '../services/comment.js';
import { notifyNewFeedback } from '../services/notification.js';
import { createApiKeyLimiter } from '../middleware/rateLimit.js';
import { moderateComment, sanitizeContent } from '../middleware/commentModeration.js';
import { getProjectCategories, getProjectCategoryObjects } from '../services/categoryConfig.js';

const apiKeyLimiter = createApiKeyLimiter();

export const publicRouter = Router({ mergeParams: true });

async function resolveProject(req: Request, _res: Response, next: NextFunction) {
  try {
    const projectSlug = req.params.projectSlug;
    if (!projectSlug) return next(new NotFoundError('项目不存在'));
    const project = await prisma.project.findFirst({ where: { slug: String(projectSlug) } });
    if (!project) return next(new NotFoundError('项目不存在'));
    req.project = project;
    next();
  } catch (err) {
    next(err);
  }
}

// Public categories endpoint (no auth, placed before resolveProject middleware)
publicRouter.get('/categories', async (req, res, next) => {
  try {
    const project = await prisma.project.findFirst({
      where: { slug: String((req.params as Record<string, string>).projectSlug) },
      select: { id: true },
    });
    if (!project) {
      res.status(404).json({ code: 404, message: 'Project not found' });
      return;
    }
    const categories = await getProjectCategoryObjects(project.id);
    success(res, categories);
  } catch (err) {
    next(err);
  }
});

publicRouter.use(resolveProject);

publicRouter.get('/feedback', async (req, res, next) => {
  try {
    const project = req.project!;
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.page_size) || 20));
    const status = req.query.status as string | undefined;
    const category = req.query.category as string | undefined;
    const sortBy = req.query.sort_by as string | undefined;

    const where: Record<string, unknown> = { project_id: project.id, deleted_at: null };
    if (status) where.status = status;
    if (category) where.category = category;

    const orderBy = sortBy === 'votes'
      ? { vote_count: 'desc' as const }
      : { created_at: 'desc' as const };

    const [items, total] = await Promise.all([
      prisma.feedback.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          _count: { select: { comments: true } },
          feedbackTags: { include: { tag: true } },
        },
      }),
      prisma.feedback.count({ where }),
    ]);

    success(res, {
      items: items.map((f) => ({
        id: f.id,
        title: f.title,
        category: f.category,
        priority: f.priority,
        status: f.status,
        vote_count: f.vote_count,
        comment_count: f._count.comments,
        tags: f.feedbackTags.map((ft) => ({ id: ft.tag.id, name: ft.tag.name, color: ft.tag.color })),
        created_at: f.created_at.toISOString(),
      })),
      page,
      page_size: pageSize,
      total,
    });
  } catch (err) {
    next(err);
  }
});

publicRouter.get('/feedback/:id', async (req, res, next) => {
  try {
    const project = req.project!;
    const feedbackId = String(req.params.id);
    const feedback = await prisma.feedback.findFirst({
      where: { id: feedbackId, project_id: project.id, deleted_at: null },
      include: {
        comments: { orderBy: { created_at: 'asc' } },
        replies: {
          orderBy: { created_at: 'asc' },
          include: { member: { select: { id: true, display_name: true } } },
        },
        feedbackTags: { include: { tag: true } },
        _count: { select: { votes: true } },
      },
    });
    if (!feedback) throw new NotFoundError('反馈不存在');
    success(res, {
      ...feedback,
      vote_count: feedback.vote_count,
      tags: feedback.feedbackTags.map((ft) => ({ id: ft.tag.id, name: ft.tag.name, color: ft.tag.color })),
      created_at: feedback.created_at.toISOString(),
      comments: feedback.comments.map((c) => ({
        id: c.id,
        email: c.author_email,
        name: c.author_name,
        content: c.content,
        created_at: c.created_at.toISOString(),
      })),
    });
  } catch (err) {
    next(err);
  }
});

publicRouter.post('/feedback', apiKeyLimiter, async (req, res, next) => {
  try {
    const project = req.project!;
    const { title, content, category, priority, contact, email } = req.body;
    if (!title || !content || !category) {
      throw new ValidationError('title、content 和 category 不能为空');
    }
    const allowedCategories = await getProjectCategories(project.id);
    if (!allowedCategories.includes(category)) {
      throw new ValidationError(`无效的分类: ${category}`);
    }
    if (contact && !isValidEmail(contact)) {
      throw new ValidationError('联系方式邮箱格式不正确');
    }
    if (email && !isValidEmail(email)) {
      throw new ValidationError('邮箱格式不正确');
    }
    const feedback = await prisma.feedback.create({
      data: {
        title,
        content,
        category,
        priority: priority || 'medium',
        contact: contact || email,
        project_id: project.id,
        source: 'board',
      },
    });

    const org = await prisma.project.findUnique({
      where: { id: project.id },
      select: { org_id: true },
    });
    if (org) {
      notifyNewFeedback(feedback.id, org.org_id).catch(() => {});
    }

    success(res, { id: feedback.id, title: feedback.title, status: feedback.status }, 201);
  } catch (err) {
    next(err);
  }
});

publicRouter.post('/feedback/:id/vote', apiKeyLimiter, async (req, res, next) => {
  try {
    const project = req.project!;
    const feedbackId = String(req.params.id);
    const { email } = req.body;
    if (!email) throw new ValidationError('邮箱不能为空');
    if (!isValidEmail(email)) throw new ValidationError('邮箱格式不正确');
    const feedback = await prisma.feedback.findFirst({
      where: { id: feedbackId, project_id: project.id, deleted_at: null },
      select: { id: true },
    });
    if (!feedback) throw new NotFoundError('反馈不存在');
    const existing = await prisma.vote.findUnique({
      where: { email_feedback_id: { email, feedback_id: feedbackId } },
    });
    if (!existing) {
      await prisma.vote.create({ data: { email, feedback_id: feedbackId } });
      await prisma.feedback.update({
        where: { id: feedbackId },
        data: { vote_count: { increment: 1 } },
      });
    }
    success(res, { voted: true });
  } catch (err) {
    next(err);
  }
});

publicRouter.delete('/feedback/:id/vote', apiKeyLimiter, async (req, res, next) => {
  try {
    const project = req.project!;
    const feedbackId = String(req.params.id);
    const { email } = req.body;
    if (!email) throw new ValidationError('邮箱不能为空');
    if (!isValidEmail(email)) throw new ValidationError('邮箱格式不正确');
    const feedback = await prisma.feedback.findFirst({
      where: { id: feedbackId, project_id: project.id, deleted_at: null },
      select: { id: true },
    });
    if (!feedback) throw new NotFoundError('反馈不存在');
    const existing = await prisma.vote.findUnique({
      where: { email_feedback_id: { email, feedback_id: feedbackId } },
    });
    if (existing) {
      await prisma.vote.delete({
        where: { email_feedback_id: { email, feedback_id: feedbackId } },
      });
      await prisma.feedback.update({
        where: { id: feedbackId },
        data: { vote_count: { decrement: 1 } },
      });
    }
    success(res, { voted: false });
  } catch (err) {
    next(err);
  }
});

publicRouter.post('/feedback/:id/comments', apiKeyLimiter, async (req, res, next) => {
  try {
    const project = req.project!;
    const feedbackId = String(req.params.id);
    const { email, name, content } = req.body;
    if (!email || !content) throw new ValidationError('邮箱和内容不能为空');
    if (!isValidEmail(email)) throw new ValidationError('邮箱格式不正确');

    const moderation = moderateComment(content);
    if (!moderation.approved) {
      throw new ValidationError(moderation.reason || '评论未通过审核');
    }

    const feedback = await prisma.feedback.findFirst({
      where: { id: feedbackId, project_id: project.id, deleted_at: null },
      select: { id: true },
    });
    if (!feedback) throw new NotFoundError('反馈不存在');
    const sanitizedContent = sanitizeContent(content);
    const sanitizedName = name ? sanitizeContent(name) : undefined;
    const comment = await addComment(feedbackId, email, sanitizedName, sanitizedContent);
    success(res, {
      id: comment.id,
      email: comment.author_email,
      name: comment.author_name,
      content: comment.content,
      created_at: comment.created_at.toISOString(),
    }, 201);
  } catch (err) {
    next(err);
  }
});

publicRouter.get('/roadmap', async (req, res, next) => {
  try {
    const project = req.project!;
    const feedbacks = await prisma.feedback.findMany({
      where: { project_id: project.id, status: { in: ['in_progress', 'resolved', 'open'] } },
      orderBy: { vote_count: 'desc' },
      select: { id: true, title: true, status: true, category: true, vote_count: true },
    });
    const roadmap = {
      planned: feedbacks.filter((f) => f.status === 'open'),
      in_progress: feedbacks.filter((f) => f.status === 'in_progress'),
      completed: feedbacks.filter((f) => f.status === 'resolved'),
    };
    success(res, roadmap);
  } catch (err) {
    next(err);
  }
});

publicRouter.get('/changelog', async (req, res, next) => {
  try {
    const project = req.project!;
    const changelogs = await prisma.changelog.findMany({
      where: { project_id: project.id, published: true },
      orderBy: { published_at: 'desc' },
    });
    success(res, changelogs);
  } catch (err) {
    next(err);
  }
});
