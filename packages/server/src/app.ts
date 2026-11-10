import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from './config/index.js';
import { healthRouter } from './routes/health.js';
import { feedbackRouter } from './routes/feedback.js';
import { adminRouter } from './routes/admin.js';
import { uploadRouter } from './routes/upload.js';
import { organizationRouter } from './routes/organization.js';
import { voteRouter } from './routes/vote.js';
import { tagRouter } from './routes/tag.js';
import { publicRouter } from './routes/public.js';
import { widgetConfigRouter } from './routes/boardConfig.js';
import { changelogRouter } from './routes/changelog.js';
import { ssoRouter } from './routes/sso.js';
import { unsubscribeRouter } from './routes/unsubscribe.js';
import { webhookRouter } from './routes/webhook.js';
import { statusConfigRouter } from './routes/statusConfig.js';
import { systemConfigRouter } from './routes/systemConfig.js';
import { notificationPreferenceRouter } from './routes/notificationPreference.js';
import { notificationCenterRouter } from './routes/notificationCenter.js';
import { memberPreferencesRouter } from './routes/memberPreferences.js';
import { categoryConfigRouter } from './routes/categoryConfig.js';
import { auditRouter } from './routes/audit.js';
import { swaggerRouter } from './routes/swagger.js';
import { errorHandler } from './middleware/error.js';
import { publicLimiter, adminLimiter } from './middleware/rateLimit.js';

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: env.CORS_ALLOWED_ORIGINS.split(',') }));
  app.use(express.json());

  app.use('/api/v1', healthRouter);
  app.use('/api/v1/feedback', publicLimiter, feedbackRouter);
  app.use('/api/v1/feedback', publicLimiter, voteRouter);
  app.use('/api/v1/upload', publicLimiter, uploadRouter);
  app.use('/api/v1/admin', adminLimiter, adminRouter);
  app.use('/api/v1/org', adminLimiter, organizationRouter);
  app.use('/api/v1/org', adminLimiter, tagRouter);
  app.use('/api/v1/org', adminLimiter, ssoRouter);
  app.use('/api/v1/org', adminLimiter, webhookRouter);
  app.use('/api/v1/org', adminLimiter, statusConfigRouter);
  app.use('/api/v1/org', adminLimiter, systemConfigRouter);
  app.use('/api/v1/org', adminLimiter, notificationPreferenceRouter);
  app.use('/api/v1/org', adminLimiter, notificationCenterRouter);
  app.use('/api/v1/org', adminLimiter, memberPreferencesRouter);
  app.use('/api/v1/org', adminLimiter, categoryConfigRouter);
  app.use('/api/v1/org', adminLimiter, auditRouter);
  app.use('/api/v1/org/changelog', adminLimiter, changelogRouter);
  app.use('/api/v1/public', publicLimiter, unsubscribeRouter);
  app.use('/api/v1/public/:projectSlug', publicLimiter, publicRouter);
  app.use('/api/v1/widget', publicLimiter, widgetConfigRouter);
  app.use('/api/v1', swaggerRouter);

  // Serve admin SPA (production) - at root
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const adminDist = path.resolve(__dirname, '../../admin/dist');
  app.use(express.static(adminDist));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(adminDist, 'index.html'));
  });

  app.use(errorHandler);

  return app;
}
