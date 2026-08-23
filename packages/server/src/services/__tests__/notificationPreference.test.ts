import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockPrisma = {
  notificationPreference: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
  },
};

vi.mock('../../db/client.js', () => ({ prisma: mockPrisma }));

const { getPreference, updatePreference, deletePreference } =
  await import('../notificationPreference.js');

describe('NotificationPreference Service', () => {
  beforeEach(() => vi.clearAllMocks());

  it('getPreference creates default if not exists', async () => {
    mockPrisma.notificationPreference.findUnique.mockResolvedValue(null);
    mockPrisma.notificationPreference.create.mockResolvedValue({
      id: 'np_1', email: 'a@x.com', project_id: 'p1', status_updates: true, weekly_digest: true,
    });
    const result = await getPreference('a@x.com', 'p1');
    expect(result.status_updates).toBe(true);
  });

  it('getPreference returns existing if found', async () => {
    mockPrisma.notificationPreference.findUnique.mockResolvedValue({
      id: 'np_1', email: 'a@x.com', project_id: 'p1', status_updates: false, weekly_digest: true,
    });
    const result = await getPreference('a@x.com', 'p1');
    expect(result.status_updates).toBe(false);
  });

  it('updatePreference updates existing record', async () => {
    mockPrisma.notificationPreference.findUnique.mockResolvedValue({ id: 'np_1' });
    mockPrisma.notificationPreference.update.mockResolvedValue({
      id: 'np_1', status_updates: false,
    });
    const result = await updatePreference('a@x.com', 'p1', { status_updates: false });
    expect(result.status_updates).toBe(false);
  });

  it('updatePreference creates if not exists', async () => {
    mockPrisma.notificationPreference.findUnique.mockResolvedValue(null);
    mockPrisma.notificationPreference.create.mockResolvedValue({
      id: 'np_2', email: 'b@x.com', project_id: 'p1', status_updates: true,
    });
    const result = await updatePreference('b@x.com', 'p1', { status_updates: true });
    expect(result.id).toBe('np_2');
  });

  it('deletePreference throws if not found', async () => {
    mockPrisma.notificationPreference.findUnique.mockResolvedValue(null);
    await expect(deletePreference('a@x.com', 'p1')).rejects.toThrow();
  });

  it('deletePreference removes existing record', async () => {
    mockPrisma.notificationPreference.findUnique.mockResolvedValue({ id: 'np_1' });
    mockPrisma.notificationPreference.delete.mockResolvedValue({ id: 'np_1' });
    const result = await deletePreference('a@x.com', 'p1');
    expect(result).toEqual({ deleted: true });
  });
});
