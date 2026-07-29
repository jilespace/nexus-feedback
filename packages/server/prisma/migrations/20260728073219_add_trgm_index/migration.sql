CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS feedback_title_trgm_idx ON feedback USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS feedback_content_trgm_idx ON feedback USING gin (content gin_trgm_ops);
CREATE INDEX IF NOT EXISTS feedback_status_idx ON feedback (status);
CREATE INDEX IF NOT EXISTS feedback_category_idx ON feedback (category);
CREATE INDEX IF NOT EXISTS feedback_priority_idx ON feedback (priority);
CREATE INDEX IF NOT EXISTS feedback_created_at_idx ON feedback (created_at DESC);
CREATE INDEX IF NOT EXISTS feedback_vote_count_idx ON feedback (vote_count DESC);
