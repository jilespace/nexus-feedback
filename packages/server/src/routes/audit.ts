import { Router } from 'express';
import { orgAuth, requireRole } from '../middleware/orgAuth.js';
import { listAuditLogs } from '../services/audit.js';
import { success } from '../utils/response.js';
import { parsePagination } from '../utils/pagination.js';

export const auditRouter = Router();

auditRouter.get('/audit-logs', orgAuth, requireRole(['owner', 'admin']), async (req, res, next) => {
  try {
    const pagination = parsePagination(req.query);
    const action = req.query.action as string | undefined;
    const actionPrefix = req.query.action_prefix as string | undefined;
    const memberId = req.query.member_id as string | undefined;
    const from = typeof req.query.from === 'string' && req.query.from ? new Date(req.query.from) : undefined;
    const to = typeof req.query.to === 'string' && req.query.to ? new Date(req.query.to) : undefined;
    const result = await listAuditLogs(
      req.orgId!,
      { action, memberId, actionPrefix, from, to },
      pagination,
    );
    success(res, result);
  } catch (err) {
    next(err);
  }
});
