export interface BoardStats {
  total: number;
  inProgress: number;
  resolved: number;
  votes: number;
}

export const emptyStats: BoardStats = {
  total: 0,
  inProgress: 0,
  resolved: 0,
  votes: 0,
};

export interface CategoryOption {
  name: string;
  count: number;
}
