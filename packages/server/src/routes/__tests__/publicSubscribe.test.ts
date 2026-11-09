import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';

vi.mock('../../db/client.js', () => ({
  prisma: {
    project: { findFirst: vi.fn() },
    notificationPreference: { upsert: vi.fn() },
  },
}));

import { prisma } from '../../db/client.js';

const project = {
  id: 'proj_1',
  slug: 'test',
  name: 'Test',
  org_id: 'org_1',
};

const upsertMock = vi.mocked(prisma.notificationPreference.upsert);

describe('POST /api/v1/public/:projectSlug/subscribe', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.project.findFirst).mockResolvedValue(project as never);
    upsertMock.mockResolvedValue({ id: 'pref_1' } as never);
  });

  it('subscribes a valid email to status updates', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/v1/public/test/subscribe')
      .send({ email: '  Fan@Example.com ', type: 'status_updates' });

    expect(res.status).toBe(200);
    expect(res.body.code).toBe(0);
    expect(res.body.data).toEqual({ subscribed: true, type: 'status_updates' });
    expect(upsertMock).toHaveBeenCalledTimes(1);
    expect(upsertMock).toHaveBeenCalledWith({
      where: { email_project_id: { email: 'fan@example.com', project_id: 'proj_1' } },
      create: {
        email: 'fan@example.com',
        project_id: 'proj_1',
        status_updates: true,
      },
      update: { status_updates: true },
    });
  });

  it('sets both preference flags for type "all"', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/v1/public/test/subscribe')
      .send({ email: 'fan@example.com', type: 'all' });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ subscribed: true, type: 'all' });
    expect(upsertMock).toHaveBeenCalledWith({
      where: { email_project_id: { email: 'fan@example.com', project_id: 'proj_1' } },
      create: {
        email: 'fan@example.com',
        project_id: 'proj_1',
        status_updates: true,
        weekly_digest: true,
      },
      update: { status_updates: true, weekly_digest: true },
    });
  });

  it('rejects an invalid email with 400', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/v1/public/test/subscribe')
      .send({ email: 'not-an-email', type: 'weekly_digest' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe(40001);
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it('rejects an invalid subscription type with 400', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/v1/public/test/subscribe')
      .send({ email: 'fan@example.com', type: 'daily_push' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe(40001);
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it('returns 404 when the project does not exist', async () => {
    vi.mocked(prisma.project.findFirst).mockResolvedValueOnce(null as never);
    const app = createApp();
    const res = await request(app)
      .post('/api/v1/public/missing/subscribe')
      .send({ email: 'fan@example.com', type: 'weekly_digest' });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe(40400);
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it('is idempotent for repeated subscriptions of the same email', async () => {
    const app = createApp();
    const payload = { email: 'fan@example.com', type: 'weekly_digest' };

    const first = await request(app).post('/api/v1/public/test/subscribe').send(payload);
    const second = await request(app).post('/api/v1/public/test/subscribe').send(payload);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(second.body.data).toEqual(first.body.data);
    expect(upsertMock).toHaveBeenCalledTimes(2);
    expect(upsertMock.mock.calls[0]?.[0]).toEqual(upsertMock.mock.calls[1]?.[0]);
    expect(upsertMock).toHaveBeenNthCalledWith(2, {
      where: { email_project_id: { email: 'fan@example.com', project_id: 'proj_1' } },
      create: {
        email: 'fan@example.com',
        project_id: 'proj_1',
        weekly_digest: true,
      },
      update: { weekly_digest: true },
    });
  });
});
