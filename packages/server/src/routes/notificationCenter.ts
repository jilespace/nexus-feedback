import { Router } from 'express';
import { orgAuth } from '../middleware/orgAuth.js';
import { success } from '../utils/response.js';
import { parsePagination } from '../utils/pagination.js';
import {
  listNotifications,
  getUnreadNotificationCount,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  getNotificationSettings,
  updateNotificationSettings,
} from '../services/notificationCenter.js';

export const notificationCenterRouter = Router();

notificationCenterRouter.use(orgAuth);

notificationCenterRouter.get('/notifications/settings', async (req, res, next) => {
  try {
    const settings = await getNotificationSettings(req.memberId!, req.orgId!);
    success(res, settings);
  } catch (err) {
    next(err);
  }
});

notificationCenterRouter.put('/notifications/settings', async (req, res, next) => {
  try {
    const settings = await updateNotificationSettings(
      req.memberId!,
      req.orgId!,
      req.body?.settings,
    );
    success(res, settings);
  } catch (err) {
    next(err);
  }
});

notificationCenterRouter.get('/notifications/unread-count', async (req, res, next) => {
  try {
    const result = await getUnreadNotificationCount(req.memberId!, req.orgId!);
    success(res, result);
  } catch (err) {
    next(err);
  }
});

notificationCenterRouter.get('/notifications', async (req, res, next) => {
  try {
    const pagination = parsePagination(req.query);
    const unreadOnly = req.query.unread === 'true';
    const result = await listNotifications(req.memberId!, req.orgId!, {
      ...pagination,
      unreadOnly,
    });
    success(res, result);
  } catch (err) {
    next(err);
  }
});

notificationCenterRouter.post('/notifications/read-all', async (req, res, next) => {
  try {
    const result = await markAllNotificationsRead(req.memberId!, req.orgId!);
    success(res, result);
  } catch (err) {
    next(err);
  }
});

notificationCenterRouter.post('/notifications/:id/read', async (req, res, next) => {
  try {
    const result = await markNotificationRead(
      req.memberId!,
      req.orgId!,
      String(req.params.id),
    );
    success(res, result);
  } catch (err) {
    next(err);
  }
});

notificationCenterRouter.delete('/notifications/:id', async (req, res, next) => {
  try {
    const result = await deleteNotification(
      req.memberId!,
      req.orgId!,
      String(req.params.id),
    );
    success(res, result);
  } catch (err) {
    next(err);
  }
});
