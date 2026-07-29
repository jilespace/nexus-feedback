-- CreateTable
CREATE TABLE "webhook_log" (
    "id" TEXT NOT NULL,
    "webhook_id" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "status_code" INTEGER,
    "success" BOOLEAN NOT NULL DEFAULT false,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "webhook_log_webhook_id_created_at_idx" ON "webhook_log"("webhook_id", "created_at");

-- AddForeignKey
ALTER TABLE "webhook_log" ADD CONSTRAINT "webhook_log_webhook_id_fkey" FOREIGN KEY ("webhook_id") REFERENCES "webhook"("id") ON DELETE CASCADE ON UPDATE CASCADE;
