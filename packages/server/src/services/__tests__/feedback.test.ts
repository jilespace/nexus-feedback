import { describe, it, expect, vi } from 'vitest';

vi.mock('../categoryConfig.js', () => ({
  getProjectCategories: vi.fn().mockResolvedValue(['bug', 'feature', 'performance', 'ui', 'other']),
}));

const { validateCreateFeedback } = await import('../feedback.js');

describe('FeedbackService', () => {
  describe('validateCreateFeedback', () => {
    it('should validate valid input', async () => {
      const input = {
        title: 'Test feedback',
        content: 'This is a test',
        category: 'bug',
        priority: 'medium',
        project_id: 'proj_1',
      };
      const result = await validateCreateFeedback(input);
      expect(result.title).toBe('Test feedback');
      expect(result.category).toBe('bug');
      expect(result.priority).toBe('medium');
    });

    it('should throw ValidationError when title is empty', async () => {
      const input = {
        title: '',
        content: 'Content',
        category: 'bug',
        project_id: 'proj_1',
      };
      await expect(validateCreateFeedback(input)).rejects.toThrow();
    });

    it('should throw ValidationError for unsupported category', async () => {
      const input = {
        title: 'Test',
        content: 'Content',
        category: 'invalid_category',
        project_id: 'proj_1',
      };
      await expect(validateCreateFeedback(input)).rejects.toThrow('无效的分类');
    });

    it('should default priority to medium', async () => {
      const input = {
        title: 'Test',
        content: 'Content',
        category: 'feature',
        project_id: 'proj_1',
      };
      const result = await validateCreateFeedback(input);
      expect(result.priority).toBe('medium');
    });

    it('should accept optional fields', async () => {
      const input = {
        title: 'Test',
        content: 'Content',
        category: 'ui',
        contact: 'user@example.com',
        app_version: '1.0.0',
        metadata: { page_url: 'https://example.com' },
        attachment_ids: ['id-1', 'id-2'],
        project_id: 'proj_1',
      };
      const result = await validateCreateFeedback(input);
      expect(result.contact).toBe('user@example.com');
      expect(result.attachment_ids).toHaveLength(2);
    });
  });
});
