import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../db/client.js', () => ({
  prisma: {
    project: { findFirst: vi.fn() },
    feedback: { createMany: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}));

vi.mock('../../services/categoryConfig.js', () => ({
  getProjectCategories: vi.fn(),
}));

const { validateFeedbackImport, previewFeedbackImport, commitFeedbackImport, MAX_IMPORT_ROWS } =
  await import('../../services/feedbackImport.js');
const { prisma } = await import('../../db/client.js');
const { getProjectCategories } = await import('../../services/categoryConfig.js');

const ORG_ID = 'org-1';
const PROJECT_ID = 'proj-1';
const CATEGORIES = ['bug', 'feature', 'performance', 'ui', 'other'];

type MockFn = ReturnType<typeof vi.fn>;

function mockValidProject(categories: string[] = CATEGORIES) {
  (prisma.project.findFirst as MockFn).mockResolvedValue({ id: PROJECT_ID });
  (getProjectCategories as MockFn).mockResolvedValue(categories);
}

function validRow(overrides: Record<string, unknown> = {}) {
  return { title: '登录后页面白屏', content: '点击登录按钮后页面空白', category: 'bug', ...overrides };
}

function params(rows: unknown[], overrides: Record<string, unknown> = {}) {
  return { orgId: ORG_ID, projectId: PROJECT_ID, rows: rows as never[], ...overrides };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockValidProject();
  (prisma.feedback.createMany as MockFn).mockResolvedValue({ count: 1 });
  (prisma.auditLog.create as MockFn).mockResolvedValue({ id: 'audit-1' });
});

describe('feedback import service', () => {
  describe('validateFeedbackImport', () => {
    it('normalizes valid rows and defaults priority to medium', async () => {
      const result = await validateFeedbackImport(
        params([validRow({ title: '  带空格的标题  ', priority: '' })]),
      );

      expect(result.total).toBe(1);
      expect(result.valid).toBe(1);
      expect(result.invalid_rows).toHaveLength(0);
      expect(result.rows[0]).toMatchObject({
        title: '带空格的标题',
        category: 'bug',
        priority: 'medium',
      });
    });

    it('escapes HTML in title and content like the API create path', async () => {
      const result = await validateFeedbackImport(
        params([validRow({ title: '<script>x</script>', content: 'a & b' })]),
      );

      expect(result.rows[0]?.title).toContain('&lt;script&gt;');
      expect(result.rows[0]?.content).toBe('a &amp; b');
    });

    it('reports an invalid category with the row index', async () => {
      const result = await validateFeedbackImport(
        params([validRow(), validRow({ category: 'nope' })]),
      );

      expect(result.valid).toBe(1);
      expect(result.invalid_rows).toEqual([
        { index: 1, errors: ['无效的分类: nope'] },
      ]);
    });

    it('reports an invalid priority', async () => {
      const result = await validateFeedbackImport(params([validRow({ priority: 'urgent' })]));

      expect(result.invalid_rows[0]).toMatchObject({ index: 0 });
      expect(result.invalid_rows[0]?.errors).toContain('无效的优先级: urgent');
    });

    it('rejects an empty title and empty content', async () => {
      const result = await validateFeedbackImport(
        params([validRow({ title: '   ', content: '' })]),
      );

      expect(result.valid).toBe(0);
      expect(result.invalid_rows[0]?.errors).toEqual(['标题不能为空', '内容不能为空']);
    });

    it('rejects over-long contact and app_version values', async () => {
      const result = await validateFeedbackImport(
        params([validRow({ contact: 'x'.repeat(201), app_version: 'v'.repeat(51) })]),
      );

      expect(result.invalid_rows[0]?.errors).toEqual([
        '联系方式不能超过 200 个字符',
        '版本号不能超过 50 个字符',
      ]);
    });

    it('rejects more than the row limit', async () => {
      const rows = Array.from({ length: MAX_IMPORT_ROWS + 1 }, () => validRow());

      await expect(validateFeedbackImport(params(rows))).rejects.toThrow(
        `单次最多导入 ${MAX_IMPORT_ROWS} 条反馈`,
      );
      expect(prisma.project.findFirst).not.toHaveBeenCalled();
    });

    it('rejects an empty row list', async () => {
      await expect(validateFeedbackImport(params([]))).rejects.toThrow('导入数据不能为空');
    });

    it('rejects a project that does not belong to the organization', async () => {
      (prisma.project.findFirst as MockFn).mockResolvedValue(null);

      await expect(validateFeedbackImport(params([validRow()]))).rejects.toThrow('项目不存在');
      expect(getProjectCategories).not.toHaveBeenCalled();
    });

    it('never writes during validation (dry run semantics)', async () => {
      await validateFeedbackImport(params([validRow()]));

      expect(prisma.feedback.createMany).not.toHaveBeenCalled();
      expect(prisma.auditLog.create).not.toHaveBeenCalled();
    });
  });

  describe('previewFeedbackImport', () => {
    it('returns only the first five normalized rows as preview', async () => {
      const rows = Array.from({ length: 7 }, (_, i) => validRow({ title: `反馈 ${i}` }));

      const preview = await previewFeedbackImport(params(rows));

      expect(preview.total).toBe(7);
      expect(preview.valid).toBe(7);
      expect(preview.preview).toHaveLength(5);
      expect(preview.preview[0]?.title).toBe('反馈 0');
      expect(prisma.feedback.createMany).not.toHaveBeenCalled();
    });

    it('returns invalid rows without writing', async () => {
      const preview = await previewFeedbackImport(
        params([validRow({ category: 'nope' }), validRow()]),
      );

      expect(preview.valid).toBe(1);
      expect(preview.invalid_rows).toHaveLength(1);
      expect(preview.invalid_rows[0]?.index).toBe(0);
      expect(prisma.feedback.createMany).not.toHaveBeenCalled();
    });
  });

  describe('commitFeedbackImport', () => {
    it('inserts all valid rows with source=import and writes one audit entry', async () => {
      (prisma.feedback.createMany as MockFn).mockResolvedValue({ count: 2 });

      const result = await commitFeedbackImport(
        params([validRow(), validRow({ category: 'feature', priority: 'high' })], {
          memberId: 'member-1',
        }),
      );

      expect(result).toEqual({ total: 2, valid: 2, imported: 2, invalid_rows: [] });
      expect(prisma.feedback.createMany).toHaveBeenCalledTimes(1);
      expect(prisma.feedback.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({
            project_id: PROJECT_ID,
            source: 'import',
            category: 'bug',
            priority: 'medium',
          }),
          expect.objectContaining({
            project_id: PROJECT_ID,
            source: 'import',
            category: 'feature',
            priority: 'high',
          }),
        ],
      });
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          org_id: ORG_ID,
          member_id: 'member-1',
          action: 'feedback.import',
          target_type: 'project',
          target_id: PROJECT_ID,
          metadata: expect.objectContaining({ count: 2, project_id: PROJECT_ID }),
        }),
      });
    });

    it('writes nothing and returns invalid rows when any row fails validation', async () => {
      const result = await commitFeedbackImport(
        params([validRow(), validRow({ priority: 'urgent' })]),
      );

      expect(result.imported).toBe(0);
      expect(result.valid).toBe(1);
      expect(result.invalid_rows).toHaveLength(1);
      expect(prisma.feedback.createMany).not.toHaveBeenCalled();
      expect(prisma.auditLog.create).not.toHaveBeenCalled();
    });
  });
});
