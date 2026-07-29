import { Router } from 'express';
import { orgAuth, requireRole } from '../middleware/orgAuth.js';
import {
  createTag,
  listTags,
  deleteTag,
  assignTag,
  unassignTag,
} from '../services/tag.js';
import { success } from '../utils/response.js';
import { parsePagination } from '../utils/pagination.js';

export const tagRouter = Router();

tagRouter.get('/tags', orgAuth, async (req, res, next) => {
  try {
    const pagination = parsePagination(req.query);
    const result = await listTags(req.orgId!, pagination);
    success(res, result);
  } catch (err) {
    next(err);
  }
});

tagRouter.post('/tags', orgAuth, async (req, res, next) => {
  try {
    const { name, color } = req.body;
    const result = await createTag(req.orgId!, name, color);
    success(res, result, 201);
  } catch (err) {
    next(err);
  }
});

tagRouter.delete('/tags/:id', orgAuth, requireRole(['owner', 'admin']), async (req, res, next) => {
  try {
    const result = await deleteTag(req.orgId!, req.params.id as string);
    success(res, result);
  } catch (err) {
    next(err);
  }
});

tagRouter.post('/feedback/:id/tags', orgAuth, async (req, res, next) => {
  try {
    const result = await assignTag(req.params.id as string, req.body.tag_id);
    success(res, result, 201);
  } catch (err) {
    next(err);
  }
});

tagRouter.delete('/feedback/:feedbackId/tags/:tagId', orgAuth, async (req, res, next) => {
  try {
    const result = await unassignTag(req.params.feedbackId as string, req.params.tagId as string);
    success(res, result);
  } catch (err) {
    next(err);
  }
});
