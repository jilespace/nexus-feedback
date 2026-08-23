-- Make system_config org-scoped so one tenant cannot override global settings (e.g. email channel) for all tenants.
-- Existing global rows cannot be attributed to a single org and are dropped (secure by default: env vars remain the fallback).

DROP INDEX IF EXISTS "system_config_key_key";

DELETE FROM "system_config";

ALTER TABLE "system_config" ADD COLUMN "org_id" TEXT NOT NULL DEFAULT '';

CREATE UNIQUE INDEX "system_config_org_id_key_key" ON "system_config"("org_id", "key");
