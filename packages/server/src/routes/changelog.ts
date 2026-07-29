import { Router } from 'express';
import { orgAuth } from '../middleware/orgAuth.js';
import { success } from '../utils/response.js';
import { ValidationError } from '../utils/errors.js';
import { parsePagination } from '../utils/pagination.js';
import {
  createChangelog,
  updateChangelog,
  publishChangelog,
  unpublishChangelog,
  deleteChangelog,
  listChangelogs,
  linkFeedback,
  unlinkFeedback,
} from '../services/changelog.js';

export const changelogRouter = Router();

changelogRouter.use(orgAuth);

changelogRouter.get('/', async (req, res, next) => {
  try {
    const projectId = req.query.project_id as string | undefined;
    const published = req.query.published === 'true' ? true
      : req.query.published === 'false' ? false : undefined;
    const pagination = parsePagination(req.query);
    const result = await listChangelogs(req.orgId!, projectId, published, pagination);
    success(res, result);
  } catch (err) {
    next(err);
  }
});

changelogRouter.post('/', async (req, res, next) => {
  try {
    const { title, content, project_id } = req.body;
    if (!title || !content || !project_id) {
      throw new ValidationError('title、content 和 project_id 不能为空');
    }
    const result = await createChangelog(req.orgId!, project_id, title, content);
    success(res, result, 201);
  } catch (err) {
    next(err);
  }
});

changelogRouter.patch('/:id', async (req, res, next) => {
  try {
    const { title, content } = req.body;
    const result = await updateChangelog(req.orgId!, req.params.id, { title, content });
    success(res, result);
  } catch (err) {
    next(err);
  }
});

changelogRouter.post('/:id/publish', async (req, res, next) => {
  try {
    const result = await publishChangelog(req.orgId!, req.params.id);
    success(res, result);
  } catch (err) {
    next(err);
  }
});

changelogRouter.post('/:id/unpublish', async (req, res, next) => {
  try {
    const result = await unpublishChangelog(req.orgId!, req.params.id);
    success(res, result);
  } catch (err) {
    next(err);
  }
});

changelogRouter.delete('/:id', async (req, res, next) => {
  try {
    await deleteChangelog(req.orgId!, req.params.id);
    success(res, null);
  } catch (err) {
    next(err);
  }
});

changelogRouter.post('/:id/feedback', async (req, res, next) => {
  try {
    const { feedback_id } = req.body;
    if (!feedback_id) throw new ValidationError('feedback_id 不能为空');
    const result = await linkFeedback(req.params.id, feedback_id);
    success(res, result, 201);
  } catch (err) {
    next(err);
  }
});

changelogRouter.delete('/:id/feedback/:feedbackId', async (req, res, next) => {
  try {
    await unlinkFeedback(req.params.id, req.params.feedbackId);
    success(res, null);
  } catch (err) {
    next(err);
  }
});
