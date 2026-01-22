ALTER TABLE "expenses" ADD COLUMN "invoice_storage_path" text;--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "invoice_size_bytes" integer;--> statement-breakpoint
ALTER TABLE "legal_documents" ADD COLUMN "file_storage_path" text;--> statement-breakpoint
ALTER TABLE "legal_documents" ADD COLUMN "file_name" text;--> statement-breakpoint
ALTER TABLE "legal_documents" ADD COLUMN "file_type" text;--> statement-breakpoint
ALTER TABLE "legal_documents" ADD COLUMN "file_size_bytes" integer;