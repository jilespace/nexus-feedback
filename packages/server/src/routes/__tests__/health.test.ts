import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';

vi.mock('../../db/client.js', () => ({
  prisma: {
    $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]),
    project: { findUnique: vi.fn() },
    feedback: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
    },
    reply: {
      create: vi.fn(),
    },
    admin: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('../../config/index.js', () => ({
  env: {
    DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
    PORT: 3000,
    NODE_ENV: 'test',
    JWT_SECRET: 'test-secret-key',
    CORS_ALLOWED_ORIGINS: 'http://localhost:8080',
    MAX_FILE_SIZE: 10485760,
    ALLOWED_FILE_TYPES: 'image/png,image/jpeg',
    STORAGE_TYPE: 'local',
    LOCAL_UPLOAD_DIR: './uploads',
  },
}));

describe('Health Route', () => {
  const app = createApp();

  it('GET /api/v1/health returns 200 with ok status', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.code).toBe(0);
    expect(res.body.data.status).toBe('ok');
    expect(res.body.data.database).toBe('ok');
  });
});
