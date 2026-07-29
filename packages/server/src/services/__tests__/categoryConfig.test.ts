import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockPrisma = {
  categoryConfig: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
};

vi.mock('../../db/client.js', () => ({ prisma: mockPrisma }));

const { listCategoryConfigs, createCategoryConfig, updateCategoryConfig, deleteCategoryConfig } =
  await import('../categoryConfig.js');

describe('CategoryConfig Service', () => {
  beforeEach(() => vi.clearAllMocks());

  it('listCategoryConfigs returns ordered categories for a project', async () => {
    mockPrisma.categoryConfig.findMany.mockResolvedValue([
      { id: '1', name: 'Bug', color: '#ef4444', position: 0 },
    ]);
    const result = await listCategoryConfigs('proj_1');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Bug');
    expect(mockPrisma.categoryConfig.findMany).toHaveBeenCalledWith({
      where: { project_id: 'proj_1' },
      orderBy: { position: 'asc' },
    });
  });

  it('createCategoryConfig defaults color and position', async () => {
    mockPrisma.categoryConfig.count.mockResolvedValue(2);
    mockPrisma.categoryConfig.create.mockResolvedValue({
      id: '2', name: 'Idea', color: '#6B7280', position: 2,
    });
    const result = await createCategoryConfig('proj_1', { name: 'Idea' });
    expect(result.position).toBe(2);
    expect(result.color).toBe('#6B7280');
  });

  it('updateCategoryConfig updates name and color', async () => {
    mockPrisma.categoryConfig.findUnique.mockResolvedValue({ id: '1', project_id: 'proj_1' });
    mockPrisma.categoryConfig.update.mockResolvedValue({
      id: '1', name: 'Bug Fix', color: '#dc2626', position: 0,
    });
    const result = await updateCategoryConfig('proj_1', '1', { name: 'Bug Fix', color: '#dc2626' });
    expect(result.name).toBe('Bug Fix');
  });

  it('deleteCategoryConfig removes a category', async () => {
    mockPrisma.categoryConfig.findUnique.mockResolvedValue({ id: '1', project_id: 'proj_1' });
    mockPrisma.categoryConfig.delete.mockResolvedValue({ id: '1' });
    await deleteCategoryConfig('proj_1', '1');
    expect(mockPrisma.categoryConfig.delete).toHaveBeenCalledWith({
      where: { id: '1' },
    });
  });
});
