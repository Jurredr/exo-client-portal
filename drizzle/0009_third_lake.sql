ALTER TABLE "projects" ALTER COLUMN "subtotal" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "hour_registrations" ADD COLUMN "category" text DEFAULT 'client' NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "type" text DEFAULT 'client' NOT NULL;