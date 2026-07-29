import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createChangelog, publishChangelog, deleteChangelog } from '../changelog.js';

vi.mock('../../db/client.js', () => ({
  prisma: {
    changelog: {
      create: vi.fn(),
      findFirst: vi.fn(),
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

    it('should throw NotFoundError if not exists', async () => {
      (prisma.changelog.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await expect(publishChangelog('org-1', 'cl-999'))
        .rejects.toThrow('更新日志不存在');
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
