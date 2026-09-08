ALTER TABLE "hour_registrations" ADD COLUMN "source" text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "hour_registrations" ADD COLUMN "source_synced_at" timestamp;