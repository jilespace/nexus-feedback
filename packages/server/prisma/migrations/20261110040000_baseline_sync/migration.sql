-- AlterTable
ALTER TABLE "member" ADD COLUMN     "invite_token" TEXT,
ADD COLUMN     "invite_token_expiry" TIMESTAMP(3),
ALTER COLUMN "password_hash" DROP NOT NULL;

-- AlterTable
ALTER TABLE "organization" ADD COLUMN     "board_url" TEXT;

-- AlterTable
ALTER TABLE "system_config" ALTER COLUMN "org_id" DROP DEFAULT;

