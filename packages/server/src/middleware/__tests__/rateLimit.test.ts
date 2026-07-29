import { describe, it, expect } from 'vitest';
import { createApiKeyLimiter } from '../rateLimit.js';

describe('createApiKeyLimiter', () => {
  it('should create a rate limiter', () => {
    const limiter = createApiKeyLimiter();
    expect(limiter).toBeDefined();
    expect(typeof limiter).toBe('function');
  });

  it('should accept custom options', () => {
    const limiter = createApiKeyLimiter({ windowMs: 60000, limit: 30 });
    expect(limiter).toBeDefined();
  });
});
