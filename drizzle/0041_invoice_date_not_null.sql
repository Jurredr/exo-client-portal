-- Backfill NULL invoice_date: set to due_date where available, else created_at
UPDATE "invoices" SET "invoice_date" = "due_date"
WHERE "invoice_date" IS NULL AND "due_date" IS NOT NULL;
--> statement-breakpoint
-- Fallback for rows where both were NULL: use created_at
UPDATE "invoices" SET "invoice_date" = "created_at"
WHERE "invoice_date" IS NULL;
--> statement-breakpoint
ALTER TABLE "invoices" ALTER COLUMN "invoice_date" SET NOT NULL;
