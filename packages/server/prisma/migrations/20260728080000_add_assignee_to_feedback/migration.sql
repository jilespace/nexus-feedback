ALTER TABLE "feedback" ADD COLUMN "assignee_id" TEXT;

ALTER TABLE "feedback" ADD CONSTRAINT "feedback_assignee_id_fkey"
  FOREIGN KEY ("assignee_id") REFERENCES "member"("id") ON DELETE SET NULL;

CREATE INDEX "feedback_assignee_id_idx" ON "feedback"("assignee_id");
