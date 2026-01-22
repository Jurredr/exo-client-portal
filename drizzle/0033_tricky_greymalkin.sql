ALTER TABLE "organizations" ADD COLUMN "image_storage_path" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "image_size_bytes" integer;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "image_storage_path" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "image_size_bytes" integer;