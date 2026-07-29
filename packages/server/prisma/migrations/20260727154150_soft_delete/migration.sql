-- AlterTable
ALTER TABLE "comment" ADD COLUMN     "deleted_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "feedback" ADD COLUMN     "deleted_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "comment_deleted_at_idx" ON "comment"("deleted_at");

-- CreateIndex
CREATE INDEX "feedback_deleted_at_idx" ON "feedback"("deleted_at");
