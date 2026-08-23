import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockPrisma = vi.hoisted(() => ({
  systemConfig: { findUnique: vi.fn(), upsert: vi.fn(), findMany: vi.fn() },
}));

vi.mock('../../db/client.js', () => ({ prisma: mockPrisma }));

vi.mock('../../config/index.js', () => ({
  env: { RESEND_API_KEY: 'env-key', RESEND_FROM_EMAIL: 'env@x.com' },
}));

import { prisma } from '../../db/client.js';
const { getConfig, setConfig, getAllConfigs, getEmailConfig } = await import('../systemConfig.js');

describe('SystemConfigService (org-scoped)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('getConfig reads the row for the given org', async () => {
    mockPrisma.systemConfig.findUnique.mockResolvedValue({ value: 'v1' });

    await getConfig('org1', 'email_api_key');

    expect(prisma.systemConfig.findUnique).toHaveBeenCalledWith({
      where: { org_id_key: { org_id: 'org1', key: 'email_api_key' } },
    });
  });

  it('setConfig writes into the given org scope', async () => {
    mockPrisma.systemConfig.upsert.mockResolvedValue({});

    await setConfig('org1', 'email_api_key', 'secret');

    expect(prisma.systemConfig.upsert).toHaveBeenCalledWith({
      where: { org_id_key: { org_id: 'org1', key: 'email_api_key' } },
      update: { value: 'secret' },
      create: { org_id: 'org1', key: 'email_api_key', value: 'secret' },
    });
  });

  it('getAllConfigs only returns rows of the given org', async () => {
    mockPrisma.systemConfig.findMany.mockResolvedValue([
      { key: 'a', value: '1' },
      { key: 'b', value: '2' },
    ]);

    const map = await getAllConfigs('org1');

    expect(map).toEqual({ a: '1', b: '2' });
    expect(prisma.systemConfig.findMany).toHaveBeenCalledWith({
      where: { org_id: 'org1' },
    });
  });

  it('getEmailConfig prefers org DB config and falls back to env', async () => {
    mockPrisma.systemConfig.findMany.mockResolvedValue([
      { key: 'email_api_key', value: 'org-key' },
      { key: 'email_from', value: 'org@x.com' },
    ]);

    const withDb = await getEmailConfig('org1');
    expect(withDb.apiKey).toBe('org-key');
    expect(withDb.fromEmail).toBe('org@x.com');

    mockPrisma.systemConfig.findMany.mockResolvedValue([]);
    const fallback = await getEmailConfig('org1');
    expect(fallback.apiKey).toBe('env-key');
    expect(fallback.fromEmail).toBe('env@x.com');
  });
});
