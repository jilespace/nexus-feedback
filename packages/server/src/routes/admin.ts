import { Router } from 'express';
import { z } from 'zod';
import { adminAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/orgAuth.js';
import {
  listFeedback,
  getFeedbackDetail,
  updateFeedbackStatus,
  updateFeedbackContent,
  addReply,
  getStats,
  batchUpdateStatus,
  getStatusHistory,
  softDeleteFeedback,
  restoreFeedback,
  assignFeedback,
  batchAssignFeedback,
} from '../services/feedback.js';
import { exportFeedbackCSV } from '../services/export.js';
import { batchAssignTags, batchUnassignTags } from '../services/tag.js';
import { mergeFeedback, previewMerge } from '../services/merge.js';
import { listComments, deleteComment } from '../services/comment.js';
import { success } from '../utils/response.js';
import { ValidationError } from '../utils/errors.js';
import { adminLogin } from '../services/admin.js';
import { getProjectCategoryObjects } from '../services/categoryConfig.js';
import { prisma } from '../db/client.js';

export const adminRouter = Router();

adminRouter.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      throw new ValidationError('用户名和密码不能为空');
    }
    const result = await adminLogin(username, password);
    success(res, result);
  } catch (err) {
    next(err);
  }
});

adminRouter.get('/categories', adminAuth, async (req, res, next) => {
  try {
    const org = await prisma.organization.findUnique({
      where: { id: req.orgId },
      include: { projects: { select: { id: true }, take: 1 } },
    });
    if (!org?.projects.length) {
      success(res, []);
      return;
    }
    const categories = await getProjectCategoryObjects(org.projects[0]!.id);
    success(res, categories);
  } catch (err) {
    next(err);
  }
});

adminRouter.get('/feedback', adminAuth, async (req, res, next) => {
  try {
    const params = {
      project_id: req.query.project_id as string | undefined,
      status: req.query.status as string | undefined,
      category: req.query.category as string | undefined,
      priority: req.query.priority as string | undefined,
      keyword: req.query.keyword as string | undefined,
      sort_by: req.query.sort_by as 'newest' | 'oldest' | 'most_voted' | undefined,
      page: req.query.page ? Number(req.query.page) : undefined,
      page_size: req.query.page_size ? Number(req.query.page_size) : undefined,
      assignee_id: req.query.assignee_id as string | undefined,
      tag_id: req.query.tag_id as string | undefined,
      view: req.query.view as 'active' | 'trash' | undefined,
    };
    const result = await listFeedback({ ...params, org_id: req.orgId });
    success(res, result);
  } catch (err) {
    next(err);
  }
});

adminRouter.get('/feedback/export', adminAuth, requireRole(['owner', 'admin']), async (req, res, next) => {
  try {
    const filters = {
      status: req.query.status as string | undefined,
      category: req.query.category as string | undefined,
      priority: req.query.priority as string | undefined,
      keyword: req.query.keyword as string | undefined,
    };
    const csv = await exportFeedbackCSV(filters, req.orgId);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=feedback-export.csv');
    res.send(csv);
  } catch (err) {
    next(err);
  }
});

adminRouter.post('/feedback/batch-tags', adminAuth, requireRole(['owner', 'admin']), async (req, res, next) => {
  try {
    const { feedback_ids, tag_ids, action } = req.body;
    if (!Array.isArray(feedback_ids) || !feedback_ids.length) {
      throw new ValidationError('反馈 ID 列表不能为空');
    }
    if (!Array.isArray(tag_ids) || !tag_ids.length) {
      throw new ValidationError('标签 ID 列表不能为空');
    }
    if (action !== 'add' && action !== 'remove') {
      throw new ValidationError('操作类型必须为 add 或 remove');
    }
    let updated: number;
    if (action === 'add') {
      updated = await batchAssignTags(feedback_ids, tag_ids, req.orgId);
    } else {
      updated = await batchUnassignTags(feedback_ids, tag_ids, req.orgId);
    }
    success(res, { updated });
  } catch (err) {
    next(err);
  }
});

adminRouter.get('/feedback/:id', adminAuth, async (req, res, next) => {
  try {
    const id = req.params.id as string;
    const result = await getFeedbackDetail(id, req.orgId);
    success(res, result);
  } catch (err) {
    next(err);
  }
});

adminRouter.get('/feedback/:id/history', adminAuth, async (req, res, next) => {
  try {
    const id = req.params.id as string;
    const result = await getStatusHistory(id, req.orgId);
    success(res, result);
  } catch (err) {
    next(err);
  }
});

adminRouter.patch('/feedback/:id/status', adminAuth, async (req, res, next) => {
  try {
    const id = req.params.id as string;
    const { status } = req.body;
    if (!status) throw new ValidationError('状态不能为空');
    const result = await updateFeedbackStatus(id, status, req.memberId, req.orgId);
    success(res, result);
  } catch (err) {
    next(err);
  }
});

adminRouter.patch('/feedback/:id', adminAuth, requireRole(['owner', 'admin']), async (req, res, next) => {
  try {
    const result = await updateFeedbackContent(
      req.params.id as string,
      req.body,
      req.memberId,
      req.orgId,
    );
    success(res, result);
  } catch (err) {
    next(err);
  }
});

adminRouter.post('/feedback/:id/replies', adminAuth, async (req, res, next) => {
  try {
    const id = req.params.id as string;
    const { content } = req.body;
    if (!content) throw new ValidationError('内容不能为空');
    const result = await addReply(id, content, req.memberId, req.orgId);
    success(res, result, 201);
  } catch (err) {
    next(err);
  }
});

adminRouter.get('/stats', adminAuth, async (req, res, next) => {
  try {
    const result = await getStats(req.orgId);
    success(res, result);
  } catch (err) {
    next(err);
  }
});

adminRouter.patch('/feedback/batch-status', adminAuth, requireRole(['owner', 'admin']), async (req, res, next) => {
  try {
    const { ids, status } = req.body;
    if (!Array.isArray(ids) || !ids.length) {
      throw new ValidationError('ID 列表不能为空');
    }
    if (!status) throw new ValidationError('状态不能为空');
    const result = await batchUpdateStatus(ids, status, req.orgId);
    success(res, result);
  } catch (err) {
    next(err);
  }
});

adminRouter.post('/feedback/:id/merge', adminAuth, requireRole(['owner', 'admin']), async (req, res, next) => {
  try {
    const id = req.params.id as string;
    const { target_id } = req.body;
    if (!target_id) throw new ValidationError('目标反馈 ID 不能为空');
    const result = await mergeFeedback(id, target_id, req.orgId);
    success(res, result);
  } catch (err) {
    next(err);
  }
});

adminRouter.post('/feedback/:id/merge-preview', adminAuth, requireRole(['owner', 'admin']), async (req, res, next) => {
  try {
    const id = req.params.id as string;
    const { target_id } = req.body;
    if (!target_id) throw new ValidationError('目标反馈 ID 不能为空');
    const result = await previewMerge(id, target_id, req.orgId);
    success(res, result);
  } catch (err) {
    next(err);
  }
});

adminRouter.get('/projects/:id/widget-config', adminAuth, requireRole(['owner', 'admin']), async (req, res, next) => {
  try {
    const { prisma } = await import('../db/client.js');
    const projectId = req.params.id as string;
    const project = await prisma.project.findFirst({
      where: { id: projectId, org_id: req.orgId },
    });
    if (!project) throw new ValidationError('项目不存在');
    const config = (project as Record<string, unknown>).widget_config
      ? JSON.parse((project as Record<string, unknown>).widget_config as string)
      : null;
    success(res, config);
  } catch (err) {
    next(err);
  }
});

const widgetConfigSchema = z
  .object({
    primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    position: z.enum(['bottom-right', 'bottom-left']).optional(),
    buttonLabel: z.string().max(20).optional(),
    successTitle: z.string().max(50).optional(),
    successMessage: z.string().max(200).optional(),
    fields: z
      .object({
        priority: z.boolean(),
        contact: z.boolean(),
        category: z.boolean(),
      })
      .partial()
      .optional(),
  })
  .strict();

adminRouter.put('/projects/:id/widget-config', adminAuth, requireRole(['owner', 'admin']), async (req, res, next) => {
  try {
    const { prisma } = await import('../db/client.js');
    const parsed = widgetConfigSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError('配置格式不正确');
    }
    const projectId = req.params.id as string;
    const project = await prisma.project.findFirst({
      where: { id: projectId, org_id: req.orgId },
    });
    if (!project) throw new ValidationError('项目不存在');
    await prisma.project.update({
      where: { id: projectId },
      data: { widget_config: JSON.stringify(parsed.data) } as Record<string, unknown>,
    });
    success(res, { saved: true });
  } catch (err) {
    next(err);
  }
});

adminRouter.get('/feedback/:id/comments', adminAuth, async (req, res, next) => {
  try {
    const result = await listComments(String(req.params.id), req.orgId ? { orgId: req.orgId } : undefined);
    success(res, result);
  } catch (err) {
    next(err);
  }
});

adminRouter.delete('/feedback/:id/comments/:commentId', adminAuth, requireRole(['owner', 'admin']), async (req, res, next) => {
  try {
    const result = await deleteComment(String(req.params.commentId), req.orgId, String(req.params.id));
    success(res, result);
  } catch (err) {
    next(err);
  }
});

adminRouter.delete('/feedback/:id', adminAuth, requireRole(['owner', 'admin']), async (req, res, next) => {
  try {
    const result = await softDeleteFeedback(String(req.params.id), req.orgId);
    success(res, { id: result.id, deleted: true });
  } catch (err) {
    next(err);
  }
});

adminRouter.post('/feedback/:id/restore', adminAuth, requireRole(['owner', 'admin']), async (req, res, next) => {
  try {
    const result = await restoreFeedback(String(req.params.id), req.orgId);
    success(res, { id: result.id, restored: true });
  } catch (err) {
    next(err);
  }
});

adminRouter.patch('/feedback/batch-assign', adminAuth, requireRole(['owner', 'admin']), async (req, res, next) => {
  try {
    const { ids, assignee_id } = req.body;
    if (!Array.isArray(ids) || !ids.length) {
      throw new ValidationError('ID 列表不能为空');
    }
    const result = await batchAssignFeedback(ids, assignee_id ?? null, req.orgId);
    success(res, result);
  } catch (err) {
    next(err);
  }
});

adminRouter.patch('/feedback/:id/assign', adminAuth, requireRole(['owner', 'admin']), async (req, res, next) => {
  try {
    const { assignee_id } = req.body;
    const result = await assignFeedback(
      String(req.params.id),
      assignee_id ?? null,
      req.orgId!,
    );
    success(res, result);
  } catch (err) {
    next(err);
  }
});
