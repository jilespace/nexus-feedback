import { Router } from 'express';
import { orgAuth } from '../middleware/orgAuth.js';
import {
  createWebhook,
  listWebhooks,
  updateWebhook,
  deleteWebhook,
  sendTestWebhook,
  listWebhookLogs,
} from '../services/webhook.js';
import { success } from '../utils/response.js';
import { ValidationError } from '../utils/errors.js';
import { parsePagination } from '../utils/pagination.js';

export const webhookRouter = Router();

webhookRouter.get('/projects/:projectId/webhooks', orgAuth, async (req, res, next) => {
  try {
    const pagination = parsePagination(req.query);
    const result = await listWebhooks(req.params.projectId as string, pagination);
    success(res, result);
  } catch (err) {
    next(err);
  }
});

webhookRouter.post('/projects/:projectId/webhooks', orgAuth, async (req, res, next) => {
  try {
    const { url, events, secret } = req.body;
    if (!url) throw new ValidationError('URL 不能为空');
    if (!Array.isArray(events) || !events.length) {
      throw new ValidationError('事件列表不能为空');
    }
    const result = await createWebhook(
      req.params.projectId as string,
      url,
      events,
      secret,
    );
    success(res, result, 201);
  } catch (err) {
    next(err);
  }
});

webhookRouter.patch('/projects/:projectId/webhooks/:id', orgAuth, async (req, res, next) => {
  try {
    const { url, events, active } = req.body;
    const result = await updateWebhook(req.params.id as string, {
      url, events, active,
    });
    success(res, result);
  } catch (err) {
    next(err);
  }
});

webhookRouter.delete('/projects/:projectId/webhooks/:id', orgAuth, async (req, res, next) => {
  try {
    const result = await deleteWebhook(req.params.id as string);
    success(res, result);
  } catch (err) {
    next(err);
  }
});

webhookRouter.post('/projects/:projectId/webhooks/:id/test', orgAuth, async (req, res, next) => {
  try {
    const result = await sendTestWebhook(String(req.params.id));
    success(res, result);
  } catch (err) {
    next(err);
  }
});

webhookRouter.get('/projects/:projectId/webhooks/:id/logs', orgAuth, async (req, res, next) => {
  try {
    const pagination = parsePagination(req.query);
    const result = await listWebhookLogs(String(req.params.id), pagination);
    success(res, result);
  } catch (err) {
    next(err);
  }
});
