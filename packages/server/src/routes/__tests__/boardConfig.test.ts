import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../../app.js';

const JWT_SECRET = 'test-secret-key-that-is-at-least-32-chars';

const mockPrisma = vi.hoisted(() => ({
  $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]),
  organization: { findUnique: vi.fn() },
  statusConfig: {
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
    findUnique: vi.fn(),
  },
  project: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
  },
  feedback: {
    create: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    count: vi.fn(),
    update: vi.fn(),
  },
  vote: { findUnique: vi.fn(), create: vi.fn(), delete: vi.fn() },
  changelog: { findMany: vi.fn() },
  categoryConfig: { findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0) },
}));

vi.mock('../../db/client.js', () => ({ prisma: mockPrisma }));

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
}));

const testProject = {
  id: 'project-1',
  org_id: 'org-1',
  name: 'Demo Project',
  slug: 'demo-project',
  widget_config: null,
};

describe('Board/Widget Config Routes', () => {
  const app = createApp();

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.organization.findUnique.mockResolvedValue({
      name: 'Demo Org',
      logo_url: null,
      brand_color: '#4c6ef5',
    });
  });

  it('GET /api/v1/public/:projectSlug/config returns project, organization, widget and roadmap defaults', async () => {
    mockPrisma.project.findFirst.mockResolvedValue(testProject);
    mockPrisma.statusConfig.findMany.mockResolvedValue([]);

    const res = await request(app).get('/api/v1/public/demo-project/config');

    expect(res.status).toBe(200);
    expect(res.body.code).toBe(0);
    expect(res.body.data.project).toEqual({ id: 'project-1', name: 'Demo Project', slug: 'demo-project' });
    expect(res.body.data.organization).toEqual({
      name: 'Demo Org',
      logo_url: null,
      brand_color: '#4c6ef5',
    });
    expect(res.body.data.widget).toEqual({});
    expect(res.body.data.roadmap).toHaveLength(4);
    expect(res.get('Cache-Control')).toBe('public, max-age=60');
  });

  it('GET /api/v1/widget/config with valid Project API Key returns widget config and configured statuses', async () => {
    mockPrisma.project.findUnique.mockResolvedValue({
      ...testProject,
      widget_config: JSON.stringify({ primaryColor: '#ff0000' }),
    });
    mockPrisma.statusConfig.findMany.mockResolvedValue([
      { name: 'todo', color: '#123456', position: 0, is_closed: false },
    ]);

    const res = await request(app)
      .get('/api/v1/widget/config')
      .set('X-API-Key', 'valid-project-key');

    expect(res.status).toBe(200);
    expect(res.body.code).toBe(0);
    expect(res.body.data.widget).toEqual({ primaryColor: '#ff0000' });
    expect(res.body.data.roadmap).toEqual([
      { name: 'todo', color: '#123456', position: 0, is_closed: false },
    ]);
  });

  it('GET /api/v1/widget/config with invalid API Key returns 401', async () => {
    mockPrisma.project.findUnique.mockResolvedValue(null);

    const res = await request(app).get('/api/v1/widget/config').set('X-API-Key', 'bad-key');

    expect(res.status).toBe(401);
    expect(res.body.code).toBe(40101);
  });

  it('PUT /api/v1/admin/projects/:id/widget-config rejects an invalid color with ValidationError', async () => {
    const token = jwt.sign({ sub: 'admin-1', typ: 'admin' }, JWT_SECRET);

    const res = await request(app)
      .put('/api/v1/admin/projects/project-1/widget-config')
      .set('Authorization', `Bearer ${token}`)
      .send({ primaryColor: 'red' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe(40001);
    expect(mockPrisma.project.update).not.toHaveBeenCalled();
  });

  it('PUT /api/v1/admin/projects/:id/widget-config persists a full valid payload as stringified JSON', async () => {
    mockPrisma.project.findFirst.mockResolvedValue(testProject);
    mockPrisma.project.update.mockResolvedValue(testProject);
    const token = jwt.sign({ sub: 'admin-1', typ: 'admin' }, JWT_SECRET);

    const payload = {
      primaryColor: '#00ff00',
      position: 'bottom-left',
      buttonLabel: '反馈',
      successTitle: '已提交',
      successMessage: '感谢反馈',
      fields: { priority: true, contact: true, category: false },
    };
    const res = await request(app)
      .put('/api/v1/admin/projects/project-1/widget-config')
      .set('Authorization', `Bearer ${token}`)
      .send(payload);

    expect(res.status).toBe(200);
    expect(res.body.data.saved).toBe(true);
    expect(mockPrisma.project.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { widget_config: JSON.stringify(payload) },
      }),
    );
  });
});
