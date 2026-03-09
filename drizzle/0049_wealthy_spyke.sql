ALTER TABLE "invoices" ADD COLUMN "sent_at" timestamp;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "sent_to_email" text;--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN "sent_at" timestamp;--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN "sent_to_email" text;