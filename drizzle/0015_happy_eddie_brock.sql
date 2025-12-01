ALTER TABLE "expenses" ALTER COLUMN "currency" SET DEFAULT 'EUR';--> statement-breakpoint
ALTER TABLE "projects" ALTER COLUMN "currency" SET DEFAULT 'EUR';--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "wise_payment_link" text;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "wise_invoice_id" text;