export interface FeedbackTag {
  id: string;
  name: string;
  color: string;
}

export interface FeedbackItem {
  id: string;
  title: string;
  content?: string;
  category: string;
  priority?: string;
  status: string;
  vote_count: number;
  comment_count?: number;
  /** 公开接口仅在详情返回来源，列表接口出于隐私不返回。 */
  source?: string;
  tags?: FeedbackTag[];
  created_at: string;
}

export interface Comment {
  id: string;
  feedback_id?: string;
  author_name?: string;
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
  content: string;
  comments: Comment[];
  replies?: Reply[];
}

export interface PaginatedResponse<T> {
  items: T[];
  page: number;
  page_size: number;
  total: number;
}

export interface RoadmapItem {
  id: string;
  title: string;
  status: string;
  category: string;
  vote_count: number;
}

export interface RoadmapColumn {
  key: string;
  name: string;
  color: string;
  items: RoadmapItem[];
}

export interface RoadmapData {
  mode?: string;
  planned?: RoadmapItem[];
  in_progress?: RoadmapItem[];
  completed?: RoadmapItem[];
  columns?: RoadmapColumn[];
}

export interface ChangelogEntry {
  id: string;
  title: string;
  content: string;
  published_at: string;
  /** `false` only for drafts; the public endpoint normally returns published entries. */
  published?: boolean;
  /** Present on the public payload; used to resolve the project for opt-outs. */
  project_id?: string;
}

export interface ProjectCategory {
  name: string;
  color: string;
}

export type SubscribeType = 'status_updates' | 'weekly_digest' | 'all';

export interface SubscribeResult {
  subscribed: boolean;
  type: SubscribeType;
}

/** Local record of a board subscription, scoped by project slug. */
export interface StoredBoardSubscription {
  email: string;
  type: SubscribeType;
  projectId?: string;
}

/** Payload returned by the signed unsubscribe-token validation endpoint. */
export interface UnsubscribeTokenPayload {
  email: string;
  project_id: string;
  type: SubscribeType;
}

export interface BoardConfig {
  project: { id?: string; name: string; slug: string };
  organization?: {
    name: string;
    logo_url?: string | null;
    brand_color?: string | null;
  } | null;
  roadmap?: Array<{
    name: string;
    color: string;
    position: number;
    is_closed: boolean;
  }>;
}

export interface ApiResponse<T> {
  code: number;
  data: T;
  message: string;
}
