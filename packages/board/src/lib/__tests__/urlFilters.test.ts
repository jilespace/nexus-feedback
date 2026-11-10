import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BOARD_FILTERS,
  buildBoardSearch,
  readBoardFilters,
} from '../urlFilters';

describe('readBoardFilters', () => {
  it('returns defaults for an empty query', () => {
    expect(readBoardFilters('')).toEqual(DEFAULT_BOARD_FILTERS);
    expect(readBoardFilters('?')).toEqual(DEFAULT_BOARD_FILTERS);
  });

  it('parses every supported filter', () => {
    expect(
      readBoardFilters(
        '?sort=created_at&status=in_progress&category=performance&q=%E5%8A%A0%E8%BD%BD',
      ),
    ).toEqual({
      sort: 'created_at',
      status: 'in_progress',
      category: 'performance',
      keyword: '加载',
    });
  });

  it('falls back to defaults for invalid sort/status values', () => {
    expect(readBoardFilters('?sort=bogus&status=bogus')).toEqual(
      DEFAULT_BOARD_FILTERS,
    );
  });

  it('keeps unknown categories and trims the keyword', () => {
    expect(readBoardFilters('?category=custom-category&q=%20abc%20')).toMatchObject({
      category: 'custom-category',
      keyword: 'abc',
    });
  });
});

describe('buildBoardSearch', () => {
  it('omits default values so clearing a filter removes its parameter', () => {
    expect(buildBoardSearch(DEFAULT_BOARD_FILTERS)).toBe('');
  });

  it('serializes only the active filters in a stable order', () => {
    expect(
      buildBoardSearch({
        sort: 'created_at',
        status: 'open',
        category: 'bug',
        keyword: '白屏',
      }),
    ).toBe('?sort=created_at&status=open&category=bug&q=%E7%99%BD%E5%B1%8F');
  });

  it('round-trips through readBoardFilters', () => {
    const filters = {
      sort: 'created_at' as const,
      status: 'resolved',
      category: 'feature',
      keyword: '导出',
    };
    expect(readBoardFilters(buildBoardSearch(filters))).toEqual(filters);
  });

  it('drops whitespace-only keywords', () => {
    expect(
      buildBoardSearch({ sort: 'votes', status: '', category: '', keyword: '   ' }),
    ).toBe('');
  });
});
