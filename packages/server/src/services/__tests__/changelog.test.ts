import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createChangelog, updateChangelog, publishChangelog, deleteChangelog } from '../changelog.js';

vi.mock('../../db/client.js', () => ({
  prisma: {
    changelog: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

import { prisma } from '../../db/client.js';

beforeEach(() => { vi.clearAllMocks(); });

describe('ChangelogService', () => {
  describe('createChangelog', () => {
    it('should create a draft changelog', async () => {
      (prisma.changelog.create as ReturnType<typeof vi.fn>)
        .mockResolvedValue({
          id: 'cl-1', org_id: 'org-1', project_id: 'p-1',
          title: 'v1.0', content: 'Release notes', published: false,
        });

      const result = await createChangelog('org-1', 'p-1', 'v1.0', 'Release notes');
      expect(result.title).toBe('v1.0');
      expect(result.published).toBe(false);
    });
  });

  describe('publishChangelog', () => {
    it('should set published to true', async () => {
      (prisma.changelog.findFirst as ReturnType<typeof vi.fn>)
        .mockResolvedValue({ id: 'cl-1', org_id: 'org-1' });
      (prisma.changelog.update as ReturnType<typeof vi.fn>)
        .mockResolvedValue({ id: 'cl-1', published: true, published_at: new Date() });

      const result = await publishChangelog('org-1', 'cl-1');
      expect(result.published).toBe(true);
    });

    it('should schedule publish with future published_at when publishAt given', async () => {
      const future = '2030-06-01T08:00:00.000Z';
      (prisma.changelog.findFirst as ReturnType<typeof vi.fn>)
        .mockResolvedValue({ id: 'cl-2', org_id: 'org-1' });
      (prisma.changelog.update as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'cl-2',
        published: true,
        published_at: new Date(future),
      });

      await publishChangelog('org-1', 'cl-2', future);
      // 定时发布：published 立即为 true，但 published_at 是未来时间，
      // 公开接口按 published_at <= now 过滤，因此到点前对外不可见
      expect(prisma.changelog.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            published: true,
            published_at: new Date(future),
          }),
        }),
      );
    });

    it('should throw NotFoundError if not exists', async () => {
      (prisma.changelog.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await expect(publishChangelog('org-1', 'cl-999'))
        .rejects.toThrow('更新日志不存在');
    });
  });

  describe('updateChangelog with publish_at', () => {
    it('should map publish_at to published_at on update', async () => {
      const iso = '2026-12-01T10:00:00.000Z';
      (prisma.changelog.findFirst as ReturnType<typeof vi.fn>)
        .mockResolvedValue({ id: 'cl-3', org_id: 'org-1' });
      (prisma.changelog.update as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'cl-3',
        title: 't',
        content: 'c',
        published_at: new Date(iso),
      });

      await updateChangelog('org-1', 'cl-3', { title: 't', publish_at: iso });
      expect(prisma.changelog.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { title: 't', published_at: new Date(iso) },
        }),
      );
    });

    it('should clear scheduled time when publish_at is null', async () => {
      (prisma.changelog.findFirst as ReturnType<typeof vi.fn>)
        .mockResolvedValue({ id: 'cl-3', org_id: 'org-1' });
      (prisma.changelog.update as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'cl-3',
        published_at: null,
      });

      await updateChangelog('org-1', 'cl-3', { publish_at: null });
      expect(prisma.changelog.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { published_at: null } }),
      );
    });

    it('should leave published_at untouched when publish_at omitted', async () => {
      (prisma.changelog.findFirst as ReturnType<typeof vi.fn>)
        .mockResolvedValue({ id: 'cl-4', org_id: 'org-1' });
      (prisma.changelog.update as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'cl-4',
      });

      await updateChangelog('org-1', 'cl-4', { content: 'x' });
      expect(prisma.changelog.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { content: 'x' } }),
      );
    });
  });

  describe('deleteChangelog', () => {
    it('should delete the changelog', async () => {
      (prisma.changelog.findFirst as ReturnType<typeof vi.fn>)
        .mockResolvedValue({ id: 'cl-1', org_id: 'org-1' });
      (prisma.changelog.delete as ReturnType<typeof vi.fn>).mockResolvedValue({});

      await deleteChangelog('org-1', 'cl-1');
      expect(prisma.changelog.delete).toHaveBeenCalledWith({ where: { id: 'cl-1' } });
    });
  });
});
