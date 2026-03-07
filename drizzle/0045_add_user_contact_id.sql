-- Phase 1.3: Add contactId to users (one-to-one link)
-- User = portal login; optionally linked to a contact record

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "contact_id" uuid REFERENCES "contacts"("id") ON DELETE SET NULL UNIQUE;
