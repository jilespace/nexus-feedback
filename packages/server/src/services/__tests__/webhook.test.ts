import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockPrisma = {
  webhook: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  webhookLog: {
    create: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
  },
};

vi.mock('../../db/client.js', () => ({ prisma: mockPrisma }));

const { listWebhooks, createWebhook, deleteWebhook, listWebhookLogs } = await import('../webhook.js');

describe('Webhook Service', () => {
  beforeEach(() => vi.clearAllMocks());

  it('listWebhooks returns paginated webhooks', async () => {
    mockPrisma.webhook.findMany.mockResolvedValue([{ id: 'wh_1', url: 'https://example.com' }]);
    mockPrisma.webhook.count.mockResolvedValue(1);
    const result = await listWebhooks('p1', { page: 1, pageSize: 20, skip: 0, take: 20 });
    expect(result.items).toHaveLength(1);
  });

  it('createWebhook returns webhook without secret in response', async () => {
    mockPrisma.webhook.create.mockResolvedValue({ id: 'wh_1', url: 'https://example.com' });
    const result = await createWebhook('org_1', 'p1', 'https://example.com', ['feedback.created']);
    expect(result.id).toBe('wh_1');
    expect(result.url).toBe('https://example.com');
  });

  it('deleteWebhook removes webhook', async () => {
    mockPrisma.webhook.findFirst.mockResolvedValue({ id: 'wh_1' });
    mockPrisma.webhook.delete.mockResolvedValue({ id: 'wh_1' });
    const result = await deleteWebhook('org_1', 'p1', 'wh_1');
    expect(result).toEqual({ id: 'wh_1' });
  });

  it('listWebhookLogs returns paginated logs', async () => {
    mockPrisma.webhookLog.findMany.mockResolvedValue([]);
    mockPrisma.webhookLog.count.mockResolvedValue(0);
    const result = await listWebhookLogs('wh_1', { page: 1, pageSize: 20, skip: 0, take: 20 });
    expect(result.items).toEqual([]);
  });
});
