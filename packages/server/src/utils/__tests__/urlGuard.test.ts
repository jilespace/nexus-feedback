import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockLookup = vi.hoisted(() => vi.fn());

vi.mock('node:dns', () => ({
  promises: { lookup: mockLookup },
}));

vi.mock('../../config/index.js', () => ({
  env: { JWT_SECRET: 'x', NODE_ENV: 'test' },
}));

import { assertSafeWebhookUrl } from '../urlGuard.js';
import { ValidationError } from '../errors.js';

describe('assertSafeWebhookUrl', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }]);
  });

  it('accepts a normal https URL', async () => {
    await expect(assertSafeWebhookUrl('https://example.com/hook')).resolves.toBeUndefined();
  });

  it('rejects localhost', async () => {
    await expect(assertSafeWebhookUrl('http://localhost/hook')).rejects.toThrow(
      '不允许的 Webhook 地址',
    );
  });

  it('rejects *.localhost subdomains', async () => {
    await expect(assertSafeWebhookUrl('https://api.localhost/hook')).rejects.toThrow(
      ValidationError,
    );
  });

  it('rejects loopback IPv4 without DNS lookup', async () => {
    await expect(assertSafeWebhookUrl('https://127.0.0.1/hook')).rejects.toThrow(ValidationError);
    expect(mockLookup).not.toHaveBeenCalled();
  });

  it('rejects private range IPv4 literals', async () => {
    await expect(assertSafeWebhookUrl('https://10.0.0.1/hook')).rejects.toThrow(ValidationError);
    await expect(assertSafeWebhookUrl('https://192.168.1.1/hook')).rejects.toThrow(ValidationError);
    await expect(assertSafeWebhookUrl('https://172.20.1.1/hook')).rejects.toThrow(ValidationError);
    await expect(assertSafeWebhookUrl('https://169.254.169.254/latest')).rejects.toThrow(
      ValidationError,
    );
    await expect(assertSafeWebhookUrl('https://0.0.0.0/hook')).rejects.toThrow(ValidationError);
  });

  it('rejects IPv6 loopback, unspecified and unique-local/link-local literals', async () => {
    await expect(assertSafeWebhookUrl('https://[::1]/hook')).rejects.toThrow(ValidationError);
    await expect(assertSafeWebhookUrl('https://[::]/hook')).rejects.toThrow(ValidationError);
    await expect(assertSafeWebhookUrl('https://[fc00::1]/hook')).rejects.toThrow(ValidationError);
    await expect(assertSafeWebhookUrl('https://[fe80::1]/hook')).rejects.toThrow(ValidationError);
    await expect(assertSafeWebhookUrl('https://[::ffff:10.0.0.1]/hook')).rejects.toThrow(
      ValidationError,
    );
  });

  it('rejects non-http(s) schemes', async () => {
    await expect(assertSafeWebhookUrl('ftp://example.com/hook')).rejects.toThrow(ValidationError);
    await expect(assertSafeWebhookUrl('file:///etc/passwd')).rejects.toThrow(ValidationError);
  });

  it('rejects malformed URLs', async () => {
    await expect(assertSafeWebhookUrl('not-a-url')).rejects.toThrow(ValidationError);
  });

  it('rejects http scheme outside development', async () => {
    await expect(assertSafeWebhookUrl('http://example.com/hook')).rejects.toThrow(ValidationError);
  });

  it('allows http scheme in development environment', async () => {
    vi.resetModules();
    vi.doMock('../../config/index.js', () => ({
      env: { JWT_SECRET: 'x', NODE_ENV: 'development' },
    }));
    const { assertSafeWebhookUrl: devGuard } = await import('../urlGuard.js');
    await expect(devGuard('http://example.com/hook')).resolves.toBeUndefined();
  });

  it('rejects unresolvable hostnames', async () => {
    mockLookup.mockRejectedValue(new Error('ENOTFOUND'));
    await expect(assertSafeWebhookUrl('https://no-such-host.invalid/hook')).rejects.toThrow(
      ValidationError,
    );
  });

  it('rejects when DNS resolves to a private address', async () => {
    mockLookup.mockResolvedValue([
      { address: '93.184.216.34', family: 4 },
      { address: '10.0.0.5', family: 4 },
    ]);
    await expect(assertSafeWebhookUrl('https://internal-rebind.example.com/hook')).rejects.toThrow(
      ValidationError,
    );
  });
});
