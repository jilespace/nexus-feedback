import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';

const mockPrisma = vi.hoisted(() => ({
  $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]),
  project: {
    findUnique: vi.fn(),
  },
  attachment: { create: vi.fn(), findUnique: vi.fn(), findMany: vi.fn() },
  feedback: {
    create: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    count: vi.fn(),
    update: vi.fn(),
  },
  statusHistory: { create: vi.fn(), findMany: vi.fn() },
  reply: { create: vi.fn() },
  admin: { findUnique: vi.fn() },
  vote: { findUnique: vi.fn(), create: vi.fn(), delete: vi.fn() },
  categoryConfig: { findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0) },
}));

vi.mock('../../db/client.js', () => ({ prisma: mockPrisma }));

vi.mock('../../services/storage.js', () => ({
  createStorageAdapter: () => ({
    upload: vi.fn().mockResolvedValue({ url: '/uploads/test.png', key: 'test.png' }),
    delete: vi.fn(),
  }),
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

describe('Feedback Routes - Auth', () => {
  const app = createApp();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('POST /api/v1/feedback without API Key returns 40100', async () => {
    const res = await request(app)
      .post('/api/v1/feedback')
      .send({ title: 'Test', content: 'Body', category: 'bug' });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe(40100);
  });

  it('POST /api/v1/feedback with invalid API Key returns 40101', async () => {
    mockPrisma.project.findUnique.mockResolvedValue(null);
    const res = await request(app)
      .post('/api/v1/feedback')
      .set('X-API-Key', 'invalid-key')
      .send({ title: 'Test', content: 'Body', category: 'bug' });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe(40101);
  });

  it('GET /api/v1/feedback/access validates a Project API Key before showing the submit page', async () => {
    mockPrisma.project.findUnique.mockResolvedValue({
      id: 'project-1',
      name: 'Demo Project',
      slug: 'demo-project',
    });

    const res = await request(app)
      .get('/api/v1/feedback/access')
      .set('X-API-Key', 'project-key');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      code: 0,
      data: {
        project: {
          id: 'project-1',
          name: 'Demo Project',
          slug: 'demo-project',
        },
      },
      message: 'ok',
    });
  });

  it('POST /api/v1/feedback returns 500 instead of crashing when Project API Key lookup fails', async () => {
    mockPrisma.project.findUnique.mockRejectedValue(new Error('database unavailable'));

    const res = await request(app)
      .post('/api/v1/feedback')
      .set('X-API-Key', 'project-key')
      .send({ title: 'Test', content: 'Body', category: 'bug' });

    expect(res.status).toBe(500);
    expect(res.body.code).toBe(50000);
  });

  it('POST /api/v1/feedback stores ownership from Project API Key', async () => {
    mockPrisma.project.findUnique.mockResolvedValue({
      id: 'project-1',
      name: 'Demo Project',
      slug: 'demo-project',
    });
    mockPrisma.feedback.create.mockResolvedValue({
      id: 'feedback-1',
      title: 'Test',
      status: 'open',
      project_id: 'project-1',
      created_at: new Date('2026-05-27T00:00:00.000Z'),
    });

    const res = await request(app)
      .post('/api/v1/feedback')
      .set('X-API-Key', 'project-key')
      .send({
        title: 'Test',
        content: 'Body',
        category: 'bug',
        project_id: 'malicious-project',
      });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      code: 0,
      data: {
        id: 'feedback-1',
        title: 'Test',
        status: 'open',
        created_at: '2026-05-27T00:00:00.000Z',
      },
      message: 'ok',
    });
    expect(mockPrisma.feedback.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          title: 'Test',
          project_id: 'project-1',
        }),
      }),
    );
    expect(mockPrisma.feedback.create).toHaveBeenCalledWith(
      expect.not.objectContaining({
        data: expect.objectContaining({
          project_id: 'malicious-project',
        }),
      }),
    );
  });

  it('POST /api/v1/upload stores attachment ownership from Project API Key', async () => {
    mockPrisma.project.findUnique.mockResolvedValue({
      id: 'project-1',
      name: 'Demo Project',
      slug: 'demo-project',
    });
    mockPrisma.attachment.create.mockResolvedValue({
      id: 'attachment-1',
      filename: 'test.png',
      url: '/uploads/test.png',
      size: 4,
      mime_type: 'image/png',
      project_id: 'project-1',
    });

    const res = await request(app)
      .post('/api/v1/upload')
      .set('X-API-Key', 'project-key')
      .attach('file', Buffer.from('test'), {
        filename: 'test.png',
        contentType: 'image/png',
      });

    expect(res.status).toBe(201);
    expect(res.body.data).toEqual({
      id: 'attachment-1',
      url: '/uploads/test.png',
      filename: 'test.png',
      size: 4,
      mime_type: 'image/png',
    });
    expect(mockPrisma.attachment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          project_id: 'project-1',
        }),
      }),
    );
  });

  it('POST /api/v1/feedback rejects attachments outside the Project API Key project', async () => {
    mockPrisma.project.findUnique.mockResolvedValue({
      id: 'project-1',
      name: 'Demo Project',
      slug: 'demo-project',
    });
    mockPrisma.attachment.findMany.mockResolvedValue([]);

    const res = await request(app)
      .post('/api/v1/feedback')
      .set('X-API-Key', 'project-key')
      .send({
        title: 'Test',
        content: 'Body',
        category: 'bug',
        attachment_ids: ['attachment-from-other-project'],
      });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe(40001);
    expect(mockPrisma.attachment.findMany).toHaveBeenCalledWith({
      where: {
        id: { in: ['attachment-from-other-project'] },
        project_id: 'project-1',
      },
      select: { id: true },
    });
    expect(mockPrisma.feedback.create).not.toHaveBeenCalled();
  });
});
