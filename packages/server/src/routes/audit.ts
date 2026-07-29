import { Router } from 'express';
import { orgAuth } from '../middleware/orgAuth.js';
import { listAuditLogs } from '../services/audit.js';
import { success } from '../utils/response.js';
import { parsePagination } from '../utils/pagination.js';

export const auditRouter = Router();

auditRouter.get('/audit-logs', orgAuth, async (req, res, next) => {
  try {
    const pagination = parsePagination(req.query);
    const action = req.query.action as string | undefined;
    const memberId = req.query.member_id as string | undefined;
    const result = await listAuditLogs(req.orgId!, { action, memberId }, pagination);
    success(res, result);
  } catch (err) {
    next(err);
  }
});
