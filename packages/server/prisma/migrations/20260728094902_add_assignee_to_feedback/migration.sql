-- DropForeignKey
ALTER TABLE "feedback" DROP CONSTRAINT "feedback_assignee_id_fkey";

-- DropIndex
DROP INDEX "feedback_category_idx";

-- DropIndex
DROP INDEX "feedback_content_trgm_idx";

-- DropIndex
DROP INDEX "feedback_created_at_idx";

-- DropIndex
DROP INDEX "feedback_priority_idx";

-- DropIndex
DROP INDEX "feedback_status_idx";

-- DropIndex
DROP INDEX "feedback_title_trgm_idx";

-- DropIndex
DROP INDEX "feedback_vote_count_idx";

-- AddForeignKey
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "member"("id") ON DELETE SET NULL ON UPDATE CASCADE;
