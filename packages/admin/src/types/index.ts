export type FeedbackStatus = 'open' | 'in_progress' | 'resolved' | 'closed';
export type FeedbackCategory = string;
export type FeedbackPriority = 'low' | 'medium' | 'high' | 'critical';

export type FeedbackSource = 'api' | 'widget' | 'submit-page' | 'board';

export type FeedbackItem = {
  id: string;
  title: string;
  category: FeedbackCategory;
  priority: FeedbackPriority;
  status: FeedbackStatus;
  source?: FeedbackSource;
  created_at: string;
  reply_count: number;
  attachment_count: number;
  assignee?: { id: string; display_name: string } | null;
  tags?: { id: string; name: string; color: string | null }[];
};

export type FeedbackDetail = {
  id: string;
  title: string;
  content: string;
  category: FeedbackCategory;
  priority: FeedbackPriority;
  status: FeedbackStatus;
  contact: string | null;
  app_version: string | null;
  metadata: Record<string, unknown> | null;
  merged_into_id: string | null;
  merged_into: { id: string; title: string } | null;
  assignee_id: string | null;
  assignee: { id: string; display_name: string; email: string } | null;
  project: { id: string; name: string; slug: string };
  attachments: Attachment[];
  replies: Reply[];
  tags?: { id: string; name: string; color: string | null }[];
  created_at: string;
  updated_at: string;
};

export type Attachment = {
  id: string;
  filename: string;
  url: string;
  size: number;
  mime_type: string;
  created_at: string;
};

export type Reply = {
  id: string;
  content: string;
  member_id?: string | null;
  member?: { id: string; display_name: string } | null;
  created_at: string;
};

export type PaginatedResponse<T> = {
  items: T[];
  page: number;
  page_size: number;
  total: number;
};

export type ProjectAccessInfo = {
  id: string;
  name: string;
  slug: string;
  api_key_prefix?: string;
  allowed_origins: string[];
  created_at: string;
  feedback_count?: number;
};

export type WeekStat = {
  week: string;
  count: number;
};

export type Stats = {
  total: number;
  open: number;
  in_progress: number;
  resolved: number;
  closed: number;
  by_category: Record<string, number>;
  by_week: WeekStat[];
  by_source: Record<string, number>;
  by_month: { month: string; count: number }[];
  avg_response_hours?: number;
};

export type OrgMemberRole = 'owner' | 'admin' | 'member';

export type OrgMember = {
  id: string;
  email: string;
  display_name: string;
  role: OrgMemberRole;
  created_at: string;
  pending?: boolean;
};

export type Organization = {
  id: string;
  name: string;
  slug: string;
  board_url?: string | null;
};

export type Tag = {
  id: string;
  name: string;
  color: string | null;
  created_at: string;
  usage_count?: number;
};

export type ChangelogEntry = {
  id: string;
  title: string;
  content: string;
  published: boolean;
  published_at: string | null;
  project_id: string | null;
  created_at: string;
  updated_at: string;
  feedbacks?: { id: string; title: string }[];
};

export type SSOConfig = {
  id: string;
  project_id: string;
  jwt_secret: string;
  user_id_claim: string;
  email_claim: string;
  name_claim: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
};

export type Webhook = {
  id: string;
  url: string;
  events: string[];
  secret: string;
  active: boolean;
  project_id: string;
  created_at: string;
  updated_at: string;
};

export type WebhookLog = {
  id: string;
  webhook_id: string;
  event: string;
  payload: string;
  status_code: number | null;
  success: boolean;
  attempts: number;
  error: string | null;
  created_at: string;
};

export type StatusConfig = {
  id: string;
  project_id: string;
  name: string;
  color: string;
  position: number;
  is_closed: boolean;
};

export type CategoryConfig = {
  id: string;
  project_id: string;
  name: string;
  color: string;
  position: number;
  created_at: string;
};

export type AuditLog = {
  id: string;
  action: string;
  target_type: string;
  target_id: string | null;
  metadata: Record<string, unknown> | null;
  member_id: string | null;
  member?: { id: string; display_name: string } | null;
  created_at: string;
};

export type WidgetFields = {
  priority: boolean;
  contact: boolean;
  category: boolean;
};

export type WidgetConfig = {
  primaryColor: string;
  position: 'bottom-right' | 'bottom-left';
  buttonLabel: string;
  successTitle: string;
  successMessage: string;
  fields: WidgetFields;
};
