import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import type { Request } from 'express';

export const publicLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { code: 42901, data: null, message: '请求过于频繁，请稍后再试' },
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { code: 42900, data: null, message: '尝试次数过多，请15分钟后再试' },
});

export const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { code: 42900, data: null, message: '请求过于频繁，请一小时后再试' },
});

export const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { code: 42901, data: null, message: '请求过于频繁，请稍后再试' },
});

export function createApiKeyLimiter(options: { windowMs?: number; limit?: number } = {}) {
  const { windowMs = 15 * 60 * 1000, limit = 30 } = options;
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: Request) => {
      const apiKey = req.headers['x-api-key'];
      return typeof apiKey === 'string' ? `apikey_${apiKey.slice(0, 8)}` : ipKeyGenerator(req.ip ?? 'unknown');
    },
    message: { code: 42902, data: null, message: 'API Key 请求过于频繁，请稍后再试' },
  });
}
