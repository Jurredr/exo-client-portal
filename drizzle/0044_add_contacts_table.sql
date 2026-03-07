-- Phase 1.2: Add contacts table
-- Contacts represent people with business relationships (client, supplier, or both)
-- They do NOT need login; they are just records

CREATE TABLE IF NOT EXISTS "contacts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "first_name" text NOT NULL,
  "last_name" text NOT NULL,
  "email" text,
  "phone" text,
  "photo" text,
  "company_id" uuid REFERENCES "companies"("id"),
  "type" text DEFAULT 'client' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

--> statement-breakpoint
-- Enable RLS on contacts (staff only for now)
ALTER TABLE "contacts" ENABLE ROW LEVEL SECURITY;

--> statement-breakpoint
CREATE POLICY "contacts_staff_all" ON "contacts" FOR ALL USING (public.is_staff_user());
