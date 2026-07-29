import { Router } from 'express';
import { orgAuth } from '../middleware/orgAuth.js';
import {
  getStatusConfigs,
  createStatusConfig,
  updateStatusConfig,
  deleteStatusConfig,
} from '../services/statusConfig.js';
import { success } from '../utils/response.js';
import { ValidationError } from '../utils/errors.js';

export const statusConfigRouter = Router();

statusConfigRouter.get('/projects/:projectId/statuses', orgAuth, async (req, res, next) => {
  try {
    const result = await getStatusConfigs(req.params.projectId as string);
    success(res, result);
  } catch (err) {
    next(err);
  }
});

statusConfigRouter.post('/projects/:projectId/statuses', orgAuth, async (req, res, next) => {
  try {
    const { name, color, position, is_closed } = req.body;
    if (!name) throw new ValidationError('状态名称不能为空');
    const result = await createStatusConfig(
      req.params.projectId as string,
      name,
      color ?? '#6B7280',
      position ?? 0,
      is_closed ?? false,
    );
    success(res, result, 201);
  } catch (err) {
    next(err);
  }
});

statusConfigRouter.patch('/projects/:projectId/statuses/:id', orgAuth, async (req, res, next) => {
  try {
    const { name, color, position, is_closed } = req.body;
    const result = await updateStatusConfig(req.params.id as string, {
      name, color, position, is_closed,
    });
    success(res, result);
  } catch (err) {
    next(err);
  }
});

statusConfigRouter.delete('/projects/:projectId/statuses/:id', orgAuth, async (req, res, next) => {
  try {
    const result = await deleteStatusConfig(req.params.id as string);
    success(res, result);
  } catch (err) {
    next(err);
  }
});
