import { Router } from 'express';
import { orgAuth, requireRole } from '../middleware/orgAuth.js';
import {
  registerOrganization,
  memberLogin,
  inviteMember,
  listMembers,
  removeMember,
  regenerateProjectApiKey,
  createProject,
  deleteProject,
  updateProject,
  updateMemberRole,
} from '../services/organization.js';
import { addNote, listNotes, deleteNote } from '../services/note.js';
import { parsePagination } from '../utils/pagination.js';
import { getOrgSettings, updateOrgSettings, changePassword, forgotPassword, resetPassword } from '../services/orgSettings.js';
import { success } from '../utils/response.js';
import { ValidationError, isValidEmail } from '../utils/errors.js';
import { prisma } from '../db/client.js';

export const organizationRouter = Router();

organizationRouter.post('/register', async (req, res, next) => {
  try {
    const { email } = req.body;
    if (email && !isValidEmail(email)) {
      throw new ValidationError('邮箱格式不正确');
    }
    const result = await registerOrganization(req.body);
    success(res, result, 201);
  } catch (err) {
    next(err);
  }
});

organizationRouter.post('/login', async (req, res, next) => {
  try {
    const { email, password, org_slug } = req.body;
    if (email && !isValidEmail(email)) {
      throw new ValidationError('邮箱格式不正确');
    }
    const result = await memberLogin(email, password, org_slug);
    success(res, result);
  } catch (err) {
    next(err);
  }
});

organizationRouter.get('/members', orgAuth, async (req, res, next) => {
  try {
    const pagination = parsePagination(req.query);
    const result = await listMembers(req.orgId!, pagination);
    success(res, result);
  } catch (err) {
    next(err);
  }
});

organizationRouter.post('/members', orgAuth, requireRole(['owner', 'admin']), async (req, res, next) => {
  try {
    const { email } = req.body;
    if (email && !isValidEmail(email)) {
      throw new ValidationError('邮箱格式不正确');
    }
    const result = await inviteMember(req.orgId!, req.body);
    success(res, result, 201);
  } catch (err) {
    next(err);
  }
});

organizationRouter.patch('/members/:id', orgAuth, requireRole(['owner']), async (req, res, next) => {
  try {
    const { role } = req.body;
    const result = await updateMemberRole(req.orgId!, req.params.id as string, role);
    success(res, result);
  } catch (err) {
    next(err);
  }
});

organizationRouter.delete('/members/:id', orgAuth, requireRole(['owner']), async (req, res, next) => {
  try {
    const result = await removeMember(req.orgId!, req.params.id as string);
    success(res, result);
  } catch (err) {
    next(err);
  }
});

organizationRouter.post('/projects', orgAuth, requireRole(['owner', 'admin']), async (req, res, next) => {
  try {
    const result = await createProject(req.orgId!, req.body);
    success(res, result, 201);
  } catch (err) {
    next(err);
  }
});

organizationRouter.get('/projects', orgAuth, async (req, res, next) => {
  try {
    const projects = await prisma.project.findMany({
      where: { org_id: req.orgId },
      include: { _count: { select: { feedbacks: true } } },
      orderBy: { created_at: 'desc' },
    });
    success(res, projects.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      api_key_prefix: p.api_key_prefix,
      allowed_origins: p.allowed_origins,
      feedback_count: p._count.feedbacks,
      created_at: p.created_at.toISOString(),
    })));
  } catch (err) {
    next(err);
  }
});

organizationRouter.get('/projects/:id', orgAuth, async (req, res, next) => {
  try {
    const project = await prisma.project.findFirst({
      where: { id: req.params.id as string, org_id: req.orgId },
    });
    if (!project) {
      res.status(404).json({ code: 40400, message: '项目不存在', data: null });
      return;
    }
    success(res, {
      id: project.id,
      name: project.name,
      slug: project.slug,
      api_key_prefix: project.api_key_prefix,
      allowed_origins: project.allowed_origins,
      created_at: project.created_at.toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

organizationRouter.delete('/projects/:id', orgAuth, requireRole(['owner', 'admin']), async (req, res, next) => {
  try {
    const result = await deleteProject(req.orgId!, req.params.id as string);
    success(res, result);
  } catch (err) {
    next(err);
  }
});

organizationRouter.patch('/projects/:id', orgAuth, requireRole(['owner', 'admin']), async (req, res, next) => {
  try {
    const result = await updateProject(req.orgId!, req.params.id as string, req.body);
    success(res, result);
  } catch (err) {
    next(err);
  }
});

organizationRouter.post('/projects/:id/regenerate-key', orgAuth, requireRole(['owner', 'admin']), async (req, res, next) => {
  try {
    const result = await regenerateProjectApiKey(req.orgId!, req.params.id as string);
    success(res, result);
  } catch (err) {
    next(err);
  }
});

// Internal Notes
organizationRouter.get('/feedback/:id/notes', orgAuth, async (req, res, next) => {
  try {
    const pagination = parsePagination(req.query);
    const result = await listNotes(req.params.id as string, pagination);
    success(res, result);
  } catch (err) {
    next(err);
  }
});

organizationRouter.post('/feedback/:id/notes', orgAuth, async (req, res, next) => {
  try {
    const { content } = req.body;
    if (!content) throw new ValidationError('内容不能为空');
    const result = await addNote(req.params.id as string, req.memberId!, content);
    success(res, result, 201);
  } catch (err) {
    next(err);
  }
});

organizationRouter.delete('/feedback/:id/notes/:noteId', orgAuth, async (req, res, next) => {
  try {
    const result = await deleteNote(req.params.noteId as string, req.memberId!);
    success(res, result);
  } catch (err) {
    next(err);
  }
});

// Organization Settings
organizationRouter.get('/settings', orgAuth, async (req, res, next) => {
  try {
    const result = await getOrgSettings(req.orgId!);
    success(res, result);
  } catch (err) {
    next(err);
  }
});

organizationRouter.patch('/settings', orgAuth, requireRole(['owner', 'admin']), async (req, res, next) => {
  try {
    const { name, logo_url, brand_color } = req.body;
    const result = await updateOrgSettings(req.orgId!, { name, logo_url, brand_color });
    success(res, result);
  } catch (err) {
    next(err);
  }
});

// Password Management
organizationRouter.post('/change-password', orgAuth, async (req, res, next) => {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) {
      throw new ValidationError('当前密码和新密码不能为空');
    }
    const result = await changePassword(req.memberId!, current_password, new_password);
    success(res, result);
  } catch (err) {
    next(err);
  }
});

organizationRouter.post('/forgot-password', async (req, res, next) => {
  try {
    const { email, org_slug } = req.body;
    if (!email || !org_slug) {
      throw new ValidationError('邮箱和组织标识不能为空');
    }
    const result = await forgotPassword(email, org_slug);
    success(res, result);
  } catch (err) {
    next(err);
  }
});

organizationRouter.post('/reset-password', async (req, res, next) => {
  try {
    const { token, new_password } = req.body;
    if (!token || !new_password) {
      throw new ValidationError('令牌和新密码不能为空');
    }
    const result = await resetPassword(token, new_password);
    success(res, result);
  } catch (err) {
    next(err);
  }
});
