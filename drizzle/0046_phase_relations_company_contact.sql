-- Phase 1.4: Update relations throughout the app
-- Link expenses, invoices, hour_registrations, offers, contracts to companies and/or contacts

-- expenses: add optional vendor company/contact (keep vendor text for backward compatibility)
ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "company_id" uuid REFERENCES "companies"("id") ON DELETE SET NULL;
ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "contact_id" uuid REFERENCES "contacts"("id") ON DELETE SET NULL;

-- invoices: add optional contact (company or contact for billing)
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "contact_id" uuid REFERENCES "contacts"("id") ON DELETE SET NULL;

-- hour_registrations: add optional contact
ALTER TABLE "hour_registrations" ADD COLUMN IF NOT EXISTS "contact_id" uuid REFERENCES "contacts"("id") ON DELETE SET NULL;

-- offers: add optional company/contact (offer can be for company or contact)
ALTER TABLE "offers" ADD COLUMN IF NOT EXISTS "company_id" uuid REFERENCES "companies"("id") ON DELETE SET NULL;
ALTER TABLE "offers" ADD COLUMN IF NOT EXISTS "contact_id" uuid REFERENCES "contacts"("id") ON DELETE SET NULL;

-- contracts: add optional contact (company or contact)
ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "contact_id" uuid REFERENCES "contacts"("id") ON DELETE SET NULL;
