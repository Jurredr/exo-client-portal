-- Contacts can belong to multiple companies (many-to-many)
-- Similar to user_companies for users

CREATE TABLE IF NOT EXISTS "contact_companies" (
  "contact_id" uuid NOT NULL REFERENCES "contacts"("id") ON DELETE CASCADE,
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "created_at" timestamp DEFAULT now() NOT NULL,
  PRIMARY KEY ("contact_id", "company_id")
);

-- Migrate existing contacts.company_id to contact_companies
INSERT INTO "contact_companies" ("contact_id", "company_id")
SELECT id, company_id FROM contacts
WHERE company_id IS NOT NULL
ON CONFLICT ("contact_id", "company_id") DO NOTHING;
