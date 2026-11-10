import { STATUS_FILTERS } from './labels';

export type BoardSortKey = 'votes' | 'created_at';

export interface BoardFilters {
  sort: BoardSortKey;
  status: string;
  category: string;
  keyword: string;
}

export const DEFAULT_BOARD_FILTERS: BoardFilters = {
  sort: 'votes',
  status: '',
  category: '',
  keyword: '',
};

/**
 * Parse the shareable board filter query. Unknown/invalid values fall back to
 * the defaults so a hand-edited link can never break the board.
 */
export function readBoardFilters(search: string): BoardFilters {
  const params = new URLSearchParams(search);
  const rawSort = params.get('sort');
  const rawStatus = params.get('status') ?? '';
  return {
    sort: rawSort === 'created_at' ? 'created_at' : 'votes',
    status: (STATUS_FILTERS as readonly string[]).includes(rawStatus)
      ? rawStatus
      : '',
    category: (params.get('category') ?? '').trim(),
    keyword: (params.get('q') ?? '').trim(),
  };
}

/**
 * Build the canonical query string for the current filters. Default values are
 * omitted so clearing a filter removes its parameter.
 */
export function buildBoardSearch(filters: BoardFilters): string {
  const params = new URLSearchParams();
  if (filters.sort !== 'votes') params.set('sort', filters.sort);
  if (filters.status) params.set('status', filters.status);
  if (filters.category) params.set('category', filters.category);
  const keyword = filters.keyword.trim();
  if (keyword) params.set('q', keyword);
  const search = params.toString();
  return search ? `?${search}` : '';
}
