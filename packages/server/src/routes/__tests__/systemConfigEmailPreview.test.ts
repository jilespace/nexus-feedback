import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../../app.js';

const JWT_SECRET = 'test-secret-key-that-is-at-least-32-chars';

vi.mock('../../db/client.js', () => ({
  prisma: {
    $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]),
    systemConfig: { findMany: vi.fn().mockResolvedValue([]) },
  },
}));

vi.mock('../../config/index.js', () => ({
  env: {
    DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
    PORT: 3000,
    NODE_ENV: 'test',
    JWT_SECRET: 'test-secret-key-that-is-at-least-32-chars',
    CORS_ALLOWED_ORIGINS: 'http://localhost:8080',
    MAX_FILE_SIZE: 10485760,
    ALLOWED_FILE_TYPES: 'image/png,image/jpeg',
    STORAGE_TYPE: 'local',
    LOCAL_UPLOAD_DIR: './uploads',
    BASE_URL: 'https://example.com',
  },
}));

vi.mock('../../services/notification.js', () => ({
  notifyNewFeedback: vi.fn().mockResolvedValue(undefined),
  notifyStatusChange: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../services/email.js', () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
  sendBatchEmails: vi.fn().mockResolvedValue(undefined),
}));

const orgToken = jwt.sign(
  { memberId: 'member-1', orgId: 'org-1', role: 'owner', typ: 'org' },
  JWT_SECRET,
  { algorithm: 'HS256' },
);
const adminRoleToken = jwt.sign(
  { memberId: 'member-2', orgId: 'org-1', role: 'admin', typ: 'org' },
  JWT_SECRET,
  { algorithm: 'HS256' },
);

const app = createApp();

function getPreview(query: string, token: string = orgToken) {
  return request(app)
    .get(`/api/v1/org/system-config/email-preview${query}`)
    .set('Authorization', `Bearer ${token}`);
}

describe('GET /org/system-config/email-preview', () => {
  it('renders the invite template with the sample organization', async () => {
    const res = await getPreview('?type=invite');

    expect(res.status).toBe(200);
    expect(res.body.code).toBe(0);
    expect(res.body.data.type).toBe('invite');
    expect(res.body.data.subject).toContain('Demo Org');
    expect(res.body.data.html).toContain('您被邀请加入 Demo Org');
    expect(res.body.data.html).toContain('接受邀请');
    expect(res.body.data.html).toContain('example.com/invite/demo-invite-token');
  });

  it('renders the password reset template', async () => {
    const res = await getPreview('?type=reset');

    expect(res.status).toBe(200);
    expect(res.body.data.type).toBe('reset');
    expect(res.body.data.subject).toBe('重置密码 - Nexus Feedback');
    expect(res.body.data.html).toContain('重置密码');
    expect(res.body.data.html).toContain('example.com/reset-password?token=demo-reset-token');
    expect(res.body.data.html).toContain('1 小时');
  });

  it('renders the status change template with sample feedback', async () => {
    const res = await getPreview('?type=status');

    expect(res.status).toBe(200);
    expect(res.body.data.type).toBe('status');
    expect(res.body.data.subject).toContain('登录后页面白屏');
    expect(res.body.data.html).toContain('反馈状态已更新');
    expect(res.body.data.html).toContain('登录后页面白屏');
    expect(res.body.data.html).toContain('in_progress');
    expect(res.body.data.html).toContain('https://example.com/feedback/sample-feedback-1');
  });

  it('renders the weekly digest template with sample metrics', async () => {
    const res = await getPreview('?type=digest');

    expect(res.status).toBe(200);
    expect(res.body.data.type).toBe('digest');
    expect(res.body.data.subject).toContain('Weekly Digest');
    expect(res.body.data.html).toContain('本周反馈摘要');
    expect(res.body.data.html).toContain('希望支持暗色模式');
    expect(res.body.data.html).toContain('>12<');
    expect(res.body.data.html).toContain('>8<');
  });

  it('rejects an unknown template type with a 400', async () => {
    const res = await getPreview('?type=unknown');

    expect(res.status).toBe(400);
    expect(res.body.code).toBe(40001);
    expect(res.body.message).toContain('无效的邮件模板类型');
  });

  it('rejects a missing template type with a 400', async () => {
    const res = await getPreview('');

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('无效的邮件模板类型');
  });

  it('requires authentication', async () => {
    const res = await request(app).get('/api/v1/org/system-config/email-preview?type=invite');

    expect(res.status).toBe(401);
  });

  it('requires the owner role', async () => {
    const res = await getPreview('?type=invite', adminRoleToken);

    expect(res.status).toBe(403);
  });
});
