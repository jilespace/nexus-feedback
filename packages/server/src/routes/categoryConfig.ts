import { Router } from 'express';
import { orgAuth } from '../middleware/orgAuth.js';
import { success } from '../utils/response.js';
import {
  listCategoryConfigs,
  createCategoryConfig,
  updateCategoryConfig,
  deleteCategoryConfig,
} from '../services/categoryConfig.js';

export const categoryConfigRouter = Router();

categoryConfigRouter.get('/projects/:projectId/categories', orgAuth, async (req, res, next) => {
  try {
    const result = await listCategoryConfigs(String(req.params.projectId));
    success(res, result);
  } catch (err) {
    next(err);
  }
});

categoryConfigRouter.post('/projects/:projectId/categories', orgAuth, async (req, res, next) => {
  try {
    const result = await createCategoryConfig(String(req.params.projectId), req.body);
    success(res, result, 201);
  } catch (err) {
    next(err);
  }
});

categoryConfigRouter.patch('/projects/:projectId/categories/:id', orgAuth, async (req, res, next) => {
  try {
    const result = await updateCategoryConfig(String(req.params.projectId), String(req.params.id), req.body);
    success(res, result);
  } catch (err) {
    next(err);
  }
});

categoryConfigRouter.delete('/projects/:projectId/categories/:id', orgAuth, async (req, res, next) => {
  try {
    await deleteCategoryConfig(String(req.params.projectId), String(req.params.id));
    success(res, { deleted: true });
  } catch (err) {
    next(err);
  }
});
