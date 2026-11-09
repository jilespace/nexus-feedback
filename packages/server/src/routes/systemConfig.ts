import { Router } from 'express';
import { orgAuth, requireRole } from '../middleware/orgAuth.js';
import { getAllConfigs, setConfig } from '../services/systemConfig.js';
import {
  EMAIL_PREVIEW_TYPES,
  buildSampleEmailPreview,
  isEmailPreviewType,
} from '../utils/emailTemplates.js';
import { success } from '../utils/response.js';
import { ValidationError } from '../utils/errors.js';

export const systemConfigRouter = Router();

const SECRET_KEYS = ['storage_access_key', 'storage_secret_key', 'email_api_key'];

function maskValue(key: string, value: string): string {
  if (!SECRET_KEYS.includes(key)) return value;
  // Empty values must stay empty so an unconfigured secret never looks set.
  if (!value) return '';
  if (value.length <= 8) return '****';
  return '****' + value.slice(-4);
}

systemConfigRouter.get('/system-config', orgAuth, requireRole(['owner']), async (req, res, next) => {
  try {
    const configs = await getAllConfigs(req.orgId!);
    const masked: Record<string, string> = {};
    for (const [k, v] of Object.entries(configs)) {
      masked[k] = maskValue(k, v);
    }
    success(res, masked);
  } catch (err) {
    next(err);
  }
});

systemConfigRouter.get(
  '/system-config/email-preview',
  orgAuth,
  requireRole(['owner']),
  async (req, res, next) => {
    try {
      const type = String(req.query.type ?? '');
      if (!isEmailPreviewType(type)) {
        throw new ValidationError(
          `无效的邮件模板类型，可选值：${EMAIL_PREVIEW_TYPES.join('、')}`,
        );
      }
      // Pure template rendering with sample data: works even when no email
      // provider is configured and never touches the database.
      const { html, subject } = buildSampleEmailPreview(type);
      success(res, { html, subject, type });
    } catch (err) {
      next(err);
    }
  },
);

systemConfigRouter.put('/system-config', orgAuth, requireRole(['owner']), async (req, res, next) => {
  try {
    const { configs } = req.body as { configs?: Record<string, string> };
    if (!configs || typeof configs !== 'object') {
      throw new ValidationError('configs 字段必须是一个对象');
    }
    for (const [key, value] of Object.entries(configs)) {
      if (typeof value !== 'string') {
        throw new ValidationError(`配置项 ${key} 的值必须是字符串`);
      }
      // Skip masked values (user didn't change them)
      if (SECRET_KEYS.includes(key) && value.startsWith('****')) {
        continue;
      }
      await setConfig(req.orgId!, key, value);
    }
    success(res, { updated: true });
  } catch (err) {
    next(err);
  }
});
