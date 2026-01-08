-- Add column as nullable first
ALTER TABLE "legal_documents" ADD COLUMN "organization_id" uuid;--> statement-breakpoint
-- Set organization_id for existing contracts based on their project's organization
UPDATE "legal_documents" 
SET "organization_id" = (
  SELECT "projects"."organization_id" 
  FROM "projects" 
  WHERE "projects"."id" = "legal_documents"."project_id"
)
WHERE "legal_documents"."project_id" IS NOT NULL
  AND "legal_documents"."type" = 'contract';--> statement-breakpoint
-- For any contracts without projects, we need to set a default organization
-- Get the first organization (or EXO organization) as fallback
-- This should not happen for existing data, but handle it just in case
UPDATE "legal_documents"
SET "organization_id" = (
  SELECT "id" FROM "organizations" 
  WHERE "name" != 'EXO' 
  ORDER BY "created_at" 
  LIMIT 1
)
WHERE "organization_id" IS NULL 
  AND "type" = 'contract'
  AND EXISTS (SELECT 1 FROM "organizations" LIMIT 1);--> statement-breakpoint
-- Now make it NOT NULL
ALTER TABLE "legal_documents" ALTER COLUMN "organization_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "legal_documents" ADD CONSTRAINT "legal_documents_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;