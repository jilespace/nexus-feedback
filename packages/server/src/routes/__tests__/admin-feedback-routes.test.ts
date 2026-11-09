import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../../app.js';

const JWT_SECRET = 'test-secret-key-that-is-at-least-32-chars';

vi.mock('../../db/client.js', () => ({
  prisma: {
    $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]),
    organization: { findUnique: vi.fn() },
    member: { findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn(), update: vi.fn() },
    project: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), update: vi.fn() },
    feedback: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    statusHistory: { create: vi.fn() },
    statusConfig: { findMany: vi.fn().mockResolvedValue([]) },
    categoryConfig: { findMany: vi.fn().mockResolvedValue([]) },
    reply: { findMany: vi.fn().mockResolvedValue([]) },
    auditLog: { create: vi.fn() },
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
  },
}));

vi.mock('../../services/notification.js', () => ({
  notifyNewFeedback: vi.fn().mockResolvedValue(undefined),
  notifyStatusChange: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../services/email.js', () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
}));

describe('Admin feedback route ordering', () => {
  const app = createApp();
  const token = jwt.sign({ sub: 'admin-1', typ: 'admin' }, JWT_SECRET, { algorithm: 'HS256' });

  it('routes PATCH /feedback/batch-status to the batch handler', async () => {
    const res = await request(app)
      .patch('/api/v1/admin/feedback/batch-status')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('ID 列表');
  });

  it('routes PATCH /feedback/batch-assign to the batch handler', async () => {
    const res = await request(app)
      .patch('/api/v1/admin/feedback/batch-assign')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('ID 列表');
  });
});
