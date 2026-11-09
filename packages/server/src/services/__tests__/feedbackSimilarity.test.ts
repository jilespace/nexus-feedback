import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../db/client.js', () => ({
  prisma: {
    feedback: { findFirst: vi.fn(), findMany: vi.fn() },
    project: { findFirst: vi.fn() },
  },
}));

const {
  scoreSimilarity,
  rankSimilarFeedback,
  findSimilarFeedback,
  findMergedSources,
  SIMILARITY_THRESHOLD,
  SIMILARITY_LIMIT,
  SIMILARITY_CANDIDATE_LIMIT,
  MERGED_SOURCES_LIMIT,
} = await import('../feedbackSimilarity.js');
const { prisma } = await import('../../db/client.js');

const findFirst = prisma.feedback.findFirst as ReturnType<typeof vi.fn>;
const findMany = prisma.feedback.findMany as ReturnType<typeof vi.fn>;
const projectFindFirst = prisma.project.findFirst as ReturnType<typeof vi.fn>;

const source = {
  id: 'fb-1',
  title: '登录页面加载很慢',
  content: '点击登录后页面一直转圈，过很久才进去。',
  category: 'bug',
  project_id: 'p1',
  feedbackTags: [{ tag: { name: '登录' } }],
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('scoreSimilarity', () => {
  it('scores identical feedback at the maximum', () => {
    const score = scoreSimilarity(
      { title: '登录页面加载很慢', content: '点击登录后一直转圈', category: 'bug', tags: ['登录'] },
      { title: '登录页面加载很慢', content: '点击登录后一直转圈', category: 'bug', tags: ['登录'] },
    );
    expect(score).toBeCloseTo(1, 5);
  });

  it('keeps a high score when only the title matches', () => {
    const score = scoreSimilarity(
      { title: '登录页面加载很慢', content: '点击登录后一直转圈', category: 'bug' },
      { title: '登录页面加载很慢', content: '另一个完全不同的描述', category: 'bug' },
    );
    expect(score).toBeGreaterThanOrEqual(0.6);
  });

  it('scores unrelated feedback below the suggestion threshold', () => {
    const score = scoreSimilarity(
      { title: 'Login page is slow', content: 'Spinner never stops', category: 'bug' },
      { title: '导出 CSV 缺少表头', content: '导出的文件第一行是数据', category: 'feature' },
    );
    expect(score).toBeLessThan(SIMILARITY_THRESHOLD);
  });

  it('matches Chinese titles through 2-gram overlap', () => {
    const close = scoreSimilarity(
      { title: '登录页面加载很慢', content: '', category: 'bug' },
      { title: '登录页面加载速度很慢', content: '', category: 'bug' },
    );
    const unrelated = scoreSimilarity(
      { title: '登录页面加载很慢', content: '', category: 'bug' },
      { title: '希望增加导出功能', content: '', category: 'feature' },
    );
    expect(close).toBeGreaterThan(0.4);
    expect(close).toBeGreaterThan(unrelated);
  });

  it('adds a small bonus for the same category and tags', () => {
    const withMeta = scoreSimilarity(
      { title: '登录页面加载很慢', content: '', category: 'bug', tags: ['登录'] },
      { title: '登录页面加载很慢', content: '', category: 'bug', tags: ['登录'] },
    );
    const withoutMeta = scoreSimilarity(
      { title: '登录页面加载很慢', content: '', category: 'bug' },
      { title: '登录页面加载很慢', content: '', category: 'feature' },
    );
    expect(withMeta).toBeGreaterThan(withoutMeta);
  });
});

describe('rankSimilarFeedback', () => {
  const base = { content: '', category: 'bug', status: 'open' };

  it('drops merged and deleted candidates', () => {
    const ranked = rankSimilarFeedback(
      { title: '登录页面加载很慢', content: '', category: 'bug' },
      [
        { ...base, id: 'fb-2', title: '登录页面加载很慢' },
        { ...base, id: 'fb-3', title: '登录页面加载很慢', merged_into_id: 'fb-9' },
        { ...base, id: 'fb-4', title: '登录页面加载很慢', deleted_at: new Date() },
      ],
    );
    expect(ranked.map((item) => item.id)).toEqual(['fb-2']);
  });

  it('filters low scores and sorts by score descending', () => {
    const ranked = rankSimilarFeedback(
      { title: '登录页面加载很慢', content: '点击登录后一直转圈', category: 'bug' },
      [
        { ...base, id: 'low', title: '导出 CSV 缺少表头', category: 'feature' },
        { ...base, id: 'mid', title: '登录页面加载速度很慢' },
        { ...base, id: 'high', title: '登录页面加载很慢', content: '点击登录后一直转圈' },
      ],
    );
    expect(ranked.every((item) => item.score >= SIMILARITY_THRESHOLD)).toBe(true);
    expect(ranked[0]?.id).toBe('high');
    expect(ranked.map((item) => item.score)).toEqual([...ranked.map((item) => item.score)].sort((a, b) => b - a));
    expect(ranked.some((item) => item.id === 'low')).toBe(false);
  });

  it('returns at most the suggestion limit', () => {
    const candidates = Array.from({ length: SIMILARITY_LIMIT + 3 }, (_, index) => ({
      ...base,
      id: `fb-${index}`,
      title: '登录页面加载很慢',
    }));
    const ranked = rankSimilarFeedback({ title: '登录页面加载很慢', category: 'bug' }, candidates);
    expect(ranked).toHaveLength(SIMILARITY_LIMIT);
  });

  it('returns a score and the public fields for each suggestion', () => {
    const [match] = rankSimilarFeedback({ title: '登录页面加载很慢', category: 'bug' }, [
      { ...base, id: 'fb-2', title: '登录页面加载很慢', category: 'bug' },
    ]);
    expect(match).toEqual({
      id: 'fb-2',
      title: '登录页面加载很慢',
      status: 'open',
      category: 'bug',
      score: expect.any(Number),
    });
  });
});

describe('findSimilarFeedback', () => {
  beforeEach(() => {
    findFirst.mockResolvedValue(source);
    projectFindFirst.mockResolvedValue({ id: 'p1' });
  });

  it('looks up same-project candidates and excludes the source itself', async () => {
    findMany.mockResolvedValue([
      {
        id: 'fb-2',
        title: '登录页面加载速度很慢',
        content: '点击登录后页面一直转圈。',
        category: 'bug',
        status: 'open',
        merged_into_id: null,
        deleted_at: null,
        feedbackTags: [{ tag: { name: '登录' } }],
      },
      {
        id: 'fb-3',
        title: '导出 CSV 缺少表头',
        content: '导出的文件第一行是数据',
        category: 'feature',
        status: 'open',
        merged_into_id: null,
        deleted_at: null,
        feedbackTags: [],
      },
      {
        id: 'fb-4',
        title: '登录页面加载很慢',
        content: '点击登录后页面一直转圈。',
        category: 'bug',
        status: 'closed',
        merged_into_id: 'fb-9',
        deleted_at: null,
        feedbackTags: [],
      },
      {
        id: 'fb-5',
        title: '登录页面加载很慢',
        content: '点击登录后页面一直转圈。',
        category: 'bug',
        status: 'closed',
        merged_into_id: null,
        deleted_at: new Date(),
        feedbackTags: [],
      },
    ]);

    const result = await findSimilarFeedback('fb-1', 'org-1');

    expect(projectFindFirst).toHaveBeenCalledWith({
      where: { id: 'p1', org_id: 'org-1' },
      select: { id: true },
    });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          project_id: 'p1',
          deleted_at: null,
          merged_into_id: null,
          id: { not: 'fb-1' },
        },
        orderBy: { created_at: 'desc' },
        take: SIMILARITY_CANDIDATE_LIMIT,
      }),
    );
    expect(result.items.map((item) => item.id)).toEqual(['fb-2']);
  });

  it('returns an empty list when nothing is similar', async () => {
    findMany.mockResolvedValue([
      {
        id: 'fb-3',
        title: '导出 CSV 缺少表头',
        content: '导出的文件第一行是数据',
        category: 'feature',
        status: 'open',
        merged_into_id: null,
        deleted_at: null,
        feedbackTags: [],
      },
    ]);
    const result = await findSimilarFeedback('fb-1', 'org-1');
    expect(result).toEqual({ items: [] });
  });

  it('rejects when the source feedback is missing', async () => {
    findFirst.mockResolvedValue(null);
    await expect(findSimilarFeedback('missing', 'org-1')).rejects.toThrow('反馈不存在');
    expect(findMany).not.toHaveBeenCalled();
  });

  it('rejects when the feedback belongs to another organisation', async () => {
    projectFindFirst.mockResolvedValue(null);
    await expect(findSimilarFeedback('fb-1', 'org-2')).rejects.toThrow('反馈不存在');
    expect(findMany).not.toHaveBeenCalled();
  });
});

describe('findMergedSources', () => {
  const rows = [
    {
      id: 'fb-a',
      title: 'Login page is slow',
      status: 'closed',
      created_at: new Date('2026-01-02T00:00:00Z'),
    },
    {
      id: 'fb-b',
      title: 'Slow login page',
      status: 'closed',
      created_at: new Date('2026-01-01T00:00:00Z'),
    },
  ];

  it('queries non-deleted feedbacks merged into the given feedback', async () => {
    findMany.mockResolvedValue(rows);
    const result = await findMergedSources('fb-target');
    expect(findMany).toHaveBeenCalledWith({
      where: { merged_into_id: 'fb-target', deleted_at: null },
      orderBy: { created_at: 'desc' },
      take: MERGED_SOURCES_LIMIT,
      select: { id: true, title: true, status: true, created_at: true },
    });
    expect(result).toEqual(rows);
  });

  it('caps the list at ten merged sources', async () => {
    expect(MERGED_SOURCES_LIMIT).toBe(10);
    findMany.mockResolvedValue(rows);
    await findMergedSources('fb-target');
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 10 }));
  });

  it('returns only the public fields of each merged source', async () => {
    findMany.mockResolvedValue(rows);
    const [first] = await findMergedSources('fb-target');
    expect(Object.keys(first ?? {}).sort()).toEqual(['created_at', 'id', 'status', 'title']);
  });

  it('returns an empty list when nothing was merged into the feedback', async () => {
    findMany.mockResolvedValue([]);
    await expect(findMergedSources('fb-target')).resolves.toEqual([]);
  });
});
