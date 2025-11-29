ALTER TABLE "legal_documents" ADD COLUMN "signature" text;--> statement-breakpoint
ALTER TABLE "legal_documents" ADD COLUMN "signed_by" uuid;--> statement-breakpoint
ALTER TABLE "legal_documents" ADD CONSTRAINT "legal_documents_signed_by_users_id_fk" FOREIGN KEY ("signed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;