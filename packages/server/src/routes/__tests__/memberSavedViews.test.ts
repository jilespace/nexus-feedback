import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../../app.js';

const JWT_SECRET = 'test-secret-key-that-is-at-least-32-chars';

vi.mock('../../db/client.js', () => ({
  prisma: {
    $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]),
    member: { findFirst: vi.fn(), update: vi.fn() },
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

vi.mock('../../services/email.js', () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../services/notification.js', () => ({
  notifyNewFeedback: vi.fn().mockResolvedValue(undefined),
  notifyStatusChange: vi.fn().mockResolvedValue(undefined),
}));

const { prisma } = await import('../../db/client.js');
const findFirst = prisma.member.findFirst as ReturnType<typeof vi.fn>;
const update = prisma.member.update as ReturnType<typeof vi.fn>;

const app = createApp();
const token = jwt.sign(
  { memberId: 'm-1', orgId: 'o-1', role: 'owner', typ: 'org' },
  JWT_SECRET,
  { algorithm: 'HS256' },
);

function authed(req: request.Test) {
  return req.set('Authorization', `Bearer ${token}`);
}

const storedView = {
  name: 'Open issues',
  filters: { status: 'open', priority: 'high' },
  created_at: '2026-01-02T03:04:05.000Z',
};

beforeEach(() => {
  vi.clearAllMocks();
  findFirst.mockResolvedValue({ id: 'm-1', saved_views: null });
  update.mockResolvedValue({ id: 'm-1' });
});

describe('GET /org/member/saved-views', () => {
  it('returns an empty array when nothing was saved yet', async () => {
    const res = await authed(request(app).get('/api/v1/org/member/saved-views'));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ code: 0, data: [], message: 'ok' });
    expect(findFirst).toHaveBeenCalledWith({
      where: { id: 'm-1', org_id: 'o-1' },
      select: { saved_views: true },
    });
  });

  it('returns stored views and skips corrupt entries', async () => {
    findFirst.mockResolvedValue({
      id: 'm-1',
      saved_views: [storedView, { name: '', filters: {} }, { name: 'bad', filters: { a: 1 } }, 'nope'],
    });

    const res = await authed(request(app).get('/api/v1/org/member/saved-views'));

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([storedView]);
  });

  it('returns 404 when the member is not part of the organisation', async () => {
    findFirst.mockResolvedValue(null);

    const res = await authed(request(app).get('/api/v1/org/member/saved-views'));

    expect(res.status).toBe(404);
  });

  it('requires authentication', async () => {
    const res = await request(app).get('/api/v1/org/member/saved-views');
    expect(res.status).toBe(401);
  });
});

describe('PUT /org/member/saved-views', () => {
  it('persists a valid list and returns the normalised views', async () => {
    const res = await authed(request(app).put('/api/v1/org/member/saved-views')).send({
      views: [{ name: '  Open issues  ', filters: { status: 'open' }, created_at: '2026-01-02T03:04:05.000Z' }],
    });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([
      { name: 'Open issues', filters: { status: 'open' }, created_at: '2026-01-02T03:04:05.000Z' },
    ]);
    expect(update).toHaveBeenCalledWith({
      where: { id: 'm-1' },
      data: {
        saved_views: [
          {
            name: 'Open issues',
            filters: { status: 'open' },
            created_at: '2026-01-02T03:04:05.000Z',
          },
        ],
      },
    });
  });

  it('accepts a bare array payload', async () => {
    const res = await authed(request(app).put('/api/v1/org/member/saved-views')).send([
      { name: 'Mine', filters: { assignee_id: 'u-1' } },
    ]);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].name).toBe('Mine');
    expect(res.body.data[0].created_at).toEqual(expect.any(String));
  });

  it('rejects more than ten views', async () => {
    const views = Array.from({ length: 11 }, (_, index) => ({
      name: `view-${index}`,
      filters: {},
    }));

    const res = await authed(request(app).put('/api/v1/org/member/saved-views')).send({ views });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('最多保存 10 个视图');
    expect(update).not.toHaveBeenCalled();
  });

  it('rejects empty, too long and duplicate names', async () => {
    const empty = await authed(request(app).put('/api/v1/org/member/saved-views')).send({
      views: [{ name: '   ', filters: {} }],
    });
    expect(empty.status).toBe(400);

    const tooLong = await authed(request(app).put('/api/v1/org/member/saved-views')).send({
      views: [{ name: 'a'.repeat(51), filters: {} }],
    });
    expect(tooLong.status).toBe(400);
    expect(tooLong.body.message).toContain('50');

    const duplicate = await authed(request(app).put('/api/v1/org/member/saved-views')).send({
      views: [
        { name: 'Same', filters: {} },
        { name: 'Same', filters: { status: 'open' } },
      ],
    });
    expect(duplicate.status).toBe(400);
    expect(duplicate.body.message).toContain('重复');
  });

  it('rejects filters that are not a string-to-string object', async () => {
    const notObject = await authed(request(app).put('/api/v1/org/member/saved-views')).send({
      views: [{ name: 'Bad', filters: 'status=open' }],
    });
    expect(notObject.status).toBe(400);

    const badValue = await authed(request(app).put('/api/v1/org/member/saved-views')).send({
      views: [{ name: 'Bad', filters: { status: 1 } }],
    });
    expect(badValue.status).toBe(400);
    expect(update).not.toHaveBeenCalled();
  });

  it('rejects a payload that is neither an array nor { views }', async () => {
    const res = await authed(request(app).put('/api/v1/org/member/saved-views')).send({
      saved: [],
    });
    expect(res.status).toBe(400);
  });

  it('returns 404 when the member is not part of the organisation', async () => {
    findFirst.mockResolvedValue(null);

    const res = await authed(request(app).put('/api/v1/org/member/saved-views')).send({ views: [] });

    expect(res.status).toBe(404);
    expect(update).not.toHaveBeenCalled();
  });
});
