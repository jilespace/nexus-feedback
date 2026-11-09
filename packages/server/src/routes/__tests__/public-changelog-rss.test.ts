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
    organization: { findUnique: vi.fn() },
    notificationPreference: { findMany: vi.fn() },
  },
}));

vi.mock('../../services/notification.js', () => ({
  notifyNewFeedback: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../services/audit.js', () => ({ logAudit: vi.fn().mockResolvedValue(undefined) }));

import { prisma } from '../../db/client.js';

describe('public changelog RSS feed', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.project.findFirst).mockResolvedValue({
      id: 'proj_1',
      slug: 'test',
      name: 'Test & Co <Demo>',
      org_id: 'org_1',
    } as never);
    vi.mocked(prisma.organization.findUnique).mockResolvedValue({
      board_url: 'https://board.example.com/',
    } as never);
    vi.mocked(prisma.changelog.findMany).mockResolvedValue([
      {
        id: 'cl_1',
        title: 'v2.0 & <beta>',
        content: '## 新功能\n**更快**的[搜索](https://example.com)，支持 A & B。',
        published_at: new Date('2026-11-09T08:00:00.000Z'),
      },
      {
        id: 'cl_2',
        title: 'v1.9',
        content: '修复若干问题',
        published_at: new Date('2026-10-01T08:00:00.000Z'),
      },
    ] as never);
  });

  it('returns a valid RSS 2.0 feed with escaped content and plain-text descriptions', async () => {
    const app = createApp();
    const res = await request(app).get('/api/v1/public/test/changelog.rss');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/rss+xml; charset=utf-8');
    expect(res.text).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(res.text).toContain('<rss version="2.0">');
    expect(res.text).toContain('<title>Test &amp; Co &lt;Demo&gt; 更新日志</title>');
    expect(res.text).toContain('<link>https://board.example.com/test/changelog</link>');
    expect(res.text).toContain('<description>Test &amp; Co &lt;Demo&gt;</description>');
    expect(res.text).toContain('<lastBuildDate>Mon, 09 Nov 2026 08:00:00 GMT</lastBuildDate>');

    // item 字段与 XML 转义
    expect(res.text).toContain('<title>v2.0 &amp; &lt;beta&gt;</title>');
    expect(res.text).toContain(
      '<link>https://board.example.com/test/changelog#changelog-cl_1</link>',
    );
    expect(res.text).toContain(
      '<guid isPermaLink="true">https://board.example.com/test/changelog#changelog-cl_1</guid>',
    );
    expect(res.text).toContain('<pubDate>Mon, 09 Nov 2026 08:00:00 GMT</pubDate>');
    // Markdown 转纯文本：标题/加粗/链接语法被剥离，正文中的 & 仍转义为实体
    expect(res.text).toContain('<description>新功能 更快的搜索，支持 A &amp; B。</description>');
    expect(res.text).not.toContain('## 新功能');
    expect(res.text).not.toContain('**更快**');
    expect(res.text.match(/<item>/g)).toHaveLength(2);

    // 只取 published=true 且已到发布时间（published_at <= now）的最近 20 条
    expect(prisma.changelog.findMany).toHaveBeenCalledWith({
      where: {
        project_id: 'proj_1',
        published: true,
        published_at: { lte: expect.any(Date) },
      },
      orderBy: { published_at: 'desc' },
      take: 20,
    });
  });

  it('returns the unified 404 JSON response for an unknown project slug', async () => {
    vi.mocked(prisma.project.findFirst).mockResolvedValue(null as never);
    const app = createApp();
    const res = await request(app).get('/api/v1/public/missing/changelog.rss');

    expect(res.status).toBe(404);
    expect(res.headers['content-type']).toContain('application/json');
    expect(res.body).toEqual({ code: 40400, data: null, message: '项目不存在' });
  });
});
