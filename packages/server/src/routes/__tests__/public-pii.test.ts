import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';

vi.mock('../../db/client.js', () => ({
  prisma: {
    project: { findFirst: vi.fn(), findUnique: vi.fn() },
    feedback: { findMany: vi.fn(), count: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    categoryConfig: { findMany: vi.fn() },
    comment: { findMany: vi.fn() },
    vote: { findUnique: vi.fn(), create: vi.fn(), delete: vi.fn() },
    changelog: { findMany: vi.fn() },
    notificationPreference: { findMany: vi.fn() },
  },
}));

vi.mock('../../services/notification.js', () => ({
  notifyNewFeedback: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../services/comment.js', () => ({
  addComment: vi.fn().mockResolvedValue({
    id: 'cmt_1',
    author_email: 'secret@example.com',
    author_name: '张三',
    content: '好建议',
    created_at: new Date('2026-01-01T00:00:00Z'),
  }),
}));
vi.mock('../../services/audit.js', () => ({ logAudit: vi.fn().mockResolvedValue(undefined) }));

import { prisma } from '../../db/client.js';

const baseFeedback = {
  id: 'fb_1',
  project_id: 'proj_1',
  title: '标题',
  content: '内容',
  category: 'bug',
  priority: 'high',
  status: 'open',
  vote_count: 3,
  source: 'board',
  contact: 'hidden@example.com',
  assignee_id: null,
  created_at: new Date('2026-01-01T00:00:00Z'),
  feedbackTags: [],
};

describe('public board PII exposure', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.project.findFirst).mockResolvedValue({
      id: 'proj_1', slug: 'test', name: 'Test', org_id: 'org_1',
    } as never);
  });

  it('GET /feedback/:id returns no contact key and comments have no email', async () => {
    vi.mocked(prisma.feedback.findFirst).mockResolvedValue({
      ...baseFeedback,
      comments: [
        {
          id: 'cmt_1',
          author_email: 'secret@example.com',
          author_name: null,
          content: '评论内容',
          created_at: new Date('2026-01-01T00:00:00Z'),
        },
      ],
      replies: [],
      _count: { votes: 3 },
    } as never);

    const app = createApp();
    const res = await request(app).get('/api/v1/public/test/feedback/fb_1');

    expect(res.status).toBe(200);
    expect(res.body.data).not.toHaveProperty('contact');
    expect(JSON.stringify(res.body.data)).not.toContain('hidden@example.com');
    expect(res.body.data.comments[0]).not.toHaveProperty('email');
    expect(JSON.stringify(res.body.data)).not.toContain('secret@example.com');
    expect(res.body.data.comments[0].author_name).toBe('匿名');
  });

  it('POST /feedback/:id/comments response has no email key', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/v1/public/test/feedback/fb_1/comments')
      .send({ email: 'user@example.com', name: '李四', content: '不错' });

    expect(res.status).toBe(201);
    expect(res.body.data).not.toHaveProperty('email');
    expect(JSON.stringify(res.body.data)).not.toContain('secret@example.com');
  });
});
