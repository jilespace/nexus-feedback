export interface FeedbackItem {
  id: string;
  title: string;
  content: string;
  category: string;
  priority?: string;
  status: string;
  vote_count: number;
  comment_count: number;
  tags?: string[];
  contact?: string;
  email?: string;
  created_at: string;
  updated_at: string;
}

export interface Comment {
  id: string;
  feedback_id: string;
  email: string;
  name?: string;
  content: string;
  created_at: string;
}

export interface Reply {
  id: string;
  content: string;
  member_id?: string | null;
  member?: { id: string; display_name: string } | null;
  created_at: string;
}

export interface FeedbackDetail extends FeedbackItem {
  comments: Comment[];
  replies?: Reply[];
}

export interface PaginatedResponse<T> {
  items: T[];
  page: number;
  page_size: number;
  total: number;
}

export interface RoadmapData {
  planned: FeedbackItem[];
  in_progress: FeedbackItem[];
  completed: FeedbackItem[];
}

export interface ChangelogEntry {
  id: string;
  title: string;
  content: string;
  published_at: string;
}

export interface ApiResponse<T> {
  code: number;
  data: T;
  message: string;
}
