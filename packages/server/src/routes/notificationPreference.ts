import { Router } from 'express';
import { orgAuth } from '../middleware/orgAuth.js';
import {
  getPreference,
  updatePreference,
  listPreferences,
  deletePreference,
} from '../services/notificationPreference.js';
import { success } from '../utils/response.js';
import { parsePagination } from '../utils/pagination.js';

export const notificationPreferenceRouter = Router();

notificationPreferenceRouter.get('/projects/:projectId/notifications', orgAuth, async (req, res, next) => {
  try {
    const pagination = parsePagination(req.query);
    const result = await listPreferences(String(req.params.projectId), pagination);
    success(res, result);
  } catch (err) {
    next(err);
  }
});

notificationPreferenceRouter.get('/projects/:projectId/notifications/:email', orgAuth, async (req, res, next) => {
  try {
    const result = await getPreference(decodeURIComponent(String(req.params.email)), String(req.params.projectId));
    success(res, result);
  } catch (err) {
    next(err);
  }
});

notificationPreferenceRouter.put('/projects/:projectId/notifications/:email', orgAuth, async (req, res, next) => {
  try {
    const result = await updatePreference(decodeURIComponent(String(req.params.email)), String(req.params.projectId), req.body);
    success(res, result);
  } catch (err) {
    next(err);
  }
});

notificationPreferenceRouter.delete('/projects/:projectId/notifications/:email', orgAuth, async (req, res, next) => {
  try {
    const result = await deletePreference(decodeURIComponent(String(req.params.email)), String(req.params.projectId));
    success(res, result);
  } catch (err) {
    next(err);
  }
});
