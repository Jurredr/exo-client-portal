ALTER TABLE "projects" ALTER COLUMN "subtotal" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" DROP COLUMN "total_price";--> statement-breakpoint
ALTER TABLE "projects" DROP COLUMN "vat";--> statement-breakpoint
ALTER TABLE "projects" DROP COLUMN "vat_percentage";--> statement-breakpoint
ALTER TABLE "projects" DROP COLUMN "client_email";