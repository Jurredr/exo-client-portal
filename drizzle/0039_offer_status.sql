-- Add status column, migrate from signed_by_client, then drop old column
ALTER TABLE "offers" ADD COLUMN "status" text;
UPDATE "offers" SET "status" = CASE WHEN "signed_by_client" = true THEN 'signed' ELSE 'draft' END;
ALTER TABLE "offers" ALTER COLUMN "status" SET DEFAULT 'draft';
ALTER TABLE "offers" ALTER COLUMN "status" SET NOT NULL;
ALTER TABLE "offers" DROP COLUMN "signed_by_client";
