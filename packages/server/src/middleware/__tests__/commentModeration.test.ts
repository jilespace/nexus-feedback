import { describe, it, expect } from 'vitest';
import { containsBannedWords, sanitizeContent, moderateComment } from '../commentModeration.js';

describe('commentModeration', () => {
  describe('containsBannedWords', () => {
    it('should return false for clean content', () => {
      expect(containsBannedWords('这是一条正常评论')).toBe(false);
    });

    it('should return true for banned words', () => {
      expect(containsBannedWords('包含垃圾广告内容')).toBe(true);
    });
  });

  describe('sanitizeContent', () => {
    it('should trim and normalize whitespace', () => {
      expect(sanitizeContent('  hello  world  ')).toBe('hello world');
    });

    it('should escape HTML entities', () => {
      expect(sanitizeContent('<script>alert(1)</script>')).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
    });
  });

  describe('moderateComment', () => {
    it('should approve valid content', () => {
      const result = moderateComment('这是一条正常的评论');
      expect(result.approved).toBe(true);
    });

    it('should reject content with banned words', () => {
      const result = moderateComment('赌博网站推荐');
      expect(result.approved).toBe(false);
      expect(result.reason).toBeDefined();
    });

    it('should reject too short content', () => {
      const result = moderateComment('a');
      expect(result.approved).toBe(false);
    });

    it('should reject too long content', () => {
      const result = moderateComment('a'.repeat(1001));
      expect(result.approved).toBe(false);
    });
  });
});
