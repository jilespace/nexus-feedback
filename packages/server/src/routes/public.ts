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
import { getBoardConfig } from '../services/boardConfig.js';

const apiKeyLimiter = createApiKeyLimiter();

function toPublicFeedback(f: {
  id: string;
  title: string;
  content: string;
  category: string;
  priority: string;
  status: string;
  vote_count: number;
  source: string;
  created_at: Date;
  feedbackTags: Array<{ tag: { id: string; name: string; color: string } }>;
}) {
  return {
    id: f.id,
    title: f.title,
    content: f.content,
    category: f.category,
    priority: f.priority,
    status: f.status,
    vote_count: f.vote_count,
    source: f.source,
    created_at: f.created_at.toISOString(),
    tags: f.feedbackTags.map((ft) => ({ id: ft.tag.id, name: ft.tag.name, color: ft.tag.color })),
  };
}

const RSS_ITEM_LIMIT = 20;
const RSS_DESCRIPTION_MAX = 300;

interface RssChangelogEntry {
  id: string;
  title: string;
  content: string;
  published_at: Date | null;
}

function escapeXml(value: string): string {
  return value
    // XML 1.0 forbids most control characters.
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Flatten Markdown changelog content into plain text for the RSS description. */
function markdownToPlainText(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s{0,3}>\s?/gm, '')
    .replace(/^\s{0,3}[-*+]\s+/gm, '')
    .replace(/^\s{0,3}\d+\.\s+/gm, '')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(.*?)\1/g, '$2')
    .replace(/~~(.*?)~~/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function truncatePlainText(text: string, max: number): string {
  const chars = Array.from(text);
  return chars.length > max ? `${chars.slice(0, max).join('')}…` : text;
}

/**
 * Absolute base URL for board links. Prefer the organization's configured board
 * URL (admin 项目接入/组织设置), fall back to the board page that opened the feed
 * (dev board proxies /api), then the API request origin.
 */
function resolveBoardBaseUrl(req: Request, configured: string | null | undefined): string {
  const configuredUrl = configured?.trim();
  if (configuredUrl) return configuredUrl.replace(/\/+$/, '');
  const referer = req.get('referer');
  if (referer) {
    try {
      return new URL(referer).origin;
    } catch {
      /* ignore malformed referer */
    }
  }
  const host = req.get('host');
  return host ? `${req.protocol}://${host}` : '';
}

function buildChangelogRss(options: {
  projectName: string;
  projectSlug: string;
  boardBaseUrl: string;
  entries: RssChangelogEntry[];
}): string {
  const { projectName, projectSlug, boardBaseUrl, entries } = options;
  const changelogUrl = `${boardBaseUrl}/${projectSlug}/changelog`;
  const items = entries
    .map((entry) => {
      const publishedAt = entry.published_at;
      if (!publishedAt) return '';
      const itemUrl = `${changelogUrl}#changelog-${entry.id}`;
      const description = truncatePlainText(
        markdownToPlainText(entry.content),
        RSS_DESCRIPTION_MAX,
      );
      return [
        '    <item>',
        `      <title>${escapeXml(entry.title)}</title>`,
        `      <link>${escapeXml(itemUrl)}</link>`,
        `      <guid isPermaLink="true">${escapeXml(itemUrl)}</guid>`,
        `      <pubDate>${publishedAt.toUTCString()}</pubDate>`,
        `      <description>${escapeXml(description)}</description>`,
        '    </item>',
      ].join('\n');
    })
    .filter(Boolean)
    .join('\n');
  const lastBuildDate = entries[0]?.published_at;

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0">',
    '  <channel>',
    `    <title>${escapeXml(`${projectName} 更新日志`)}</title>`,
    `    <link>${escapeXml(changelogUrl)}</link>`,
    `    <description>${escapeXml(projectName)}</description>`,
    ...(lastBuildDate
      ? [`    <lastBuildDate>${lastBuildDate.toUTCString()}</lastBuildDate>`]
      : []),
    ...(items ? [items] : []),
    '  </channel>',
    '</rss>',
    '',
  ].join('\n');
}

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
      ...toPublicFeedback(feedback),
      comments: feedback.comments.map((c) => ({
        id: c.id,
        author_name: c.author_name || '匿名',
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
      author_name: comment.author_name || '匿名',
      content: comment.content,
      created_at: comment.created_at.toISOString(),
    }, 201);
  } catch (err) {
    next(err);
  }
});

publicRouter.get('/config', async (req, res, next) => {
  try {
    const config = await getBoardConfig(req.project!);
    res.set('Cache-Control', 'public, max-age=60');
    success(res, config);
  } catch (err) {
    next(err);
  }
});

publicRouter.get('/roadmap', async (req, res, next) => {
  try {
    const project = req.project!;
    const configs = await prisma.statusConfig.findMany({
      where: { project_id: project.id },
      orderBy: { position: 'asc' },
    });

    if (configs.length > 0) {
      const feedbacks = await prisma.feedback.findMany({
        where: { project_id: project.id, deleted_at: null },
        orderBy: { vote_count: 'desc' },
        select: { id: true, title: true, status: true, category: true, vote_count: true },
      });
      const columns = configs.map((c) => ({
        key: c.name,
        name: c.name,
        color: c.color,
        items: feedbacks.filter((f) => f.status === c.name),
      }));
      success(res, { mode: 'custom', columns });
      return;
    }

    const feedbacks = await prisma.feedback.findMany({
      where: { project_id: project.id, status: { in: ['in_progress', 'resolved', 'open'] } },
      orderBy: { vote_count: 'desc' },
      select: { id: true, title: true, status: true, category: true, vote_count: true },
    });
    success(res, {
      mode: 'default',
      planned: feedbacks.filter((f) => f.status === 'open'),
      in_progress: feedbacks.filter((f) => f.status === 'in_progress'),
      completed: feedbacks.filter((f) => f.status === 'resolved'),
    });
  } catch (err) {
    next(err);
  }
});

publicRouter.get('/changelog', async (req, res, next) => {
  try {
    const project = req.project!;
    const changelogs = await prisma.changelog.findMany({
      where: {
        project_id: project.id,
        published: true,
        OR: [{ published_at: null }, { published_at: { lte: new Date() } }],
      },
      orderBy: { published_at: 'desc' },
    });
    success(res, changelogs);
  } catch (err) {
    next(err);
  }
});

publicRouter.get('/changelog.rss', async (req, res, next) => {
  try {
    const project = req.project!;
    const [organization, changelogs] = await Promise.all([
      prisma.organization.findUnique({
        where: { id: project.org_id },
        select: { board_url: true },
      }),
      prisma.changelog.findMany({
        where: {
          project_id: project.id,
          published: true,
          published_at: { lte: new Date() },
        },
        orderBy: { published_at: 'desc' },
        take: RSS_ITEM_LIMIT,
      }),
    ]);

    const xml = buildChangelogRss({
      projectName: project.name,
      projectSlug: project.slug,
      boardBaseUrl: resolveBoardBaseUrl(req, organization?.board_url),
      entries: changelogs,
    });

    res.set('Content-Type', 'application/rss+xml; charset=utf-8');
    res.status(200).send(xml);
  } catch (err) {
    next(err);
  }
});
