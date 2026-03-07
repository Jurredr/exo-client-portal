-- Phase 1.1: Migrate organizations to companies
-- Preserves all data - renames table and columns, adds type enum

-- Step 1: Drop RLS policies that reference organizations (they'll be recreated)
DROP POLICY IF EXISTS "organizations_staff_all" ON "organizations";
DROP POLICY IF EXISTS "organizations_clients_select" ON "organizations";
DROP POLICY IF EXISTS "users_staff_all" ON "users";
DROP POLICY IF EXISTS "users_clients_select" ON "users";
DROP POLICY IF EXISTS "projects_staff_all" ON "projects";
DROP POLICY IF EXISTS "projects_clients_select" ON "projects";
DROP POLICY IF EXISTS "deliverables_staff_all" ON "deliverables";
DROP POLICY IF EXISTS "deliverables_clients_select" ON "deliverables";
DROP POLICY IF EXISTS "client_assets_staff_all" ON "client_assets";
DROP POLICY IF EXISTS "client_assets_clients_select" ON "client_assets";
DROP POLICY IF EXISTS "contracts_staff_all" ON "contracts";
DROP POLICY IF EXISTS "contracts_clients_select" ON "contracts";
DROP POLICY IF EXISTS "contract_projects_staff_all" ON "contract_projects";
DROP POLICY IF EXISTS "contract_projects_clients_select" ON "contract_projects";
DROP POLICY IF EXISTS "user_organizations_staff_all" ON "user_organizations";
DROP POLICY IF EXISTS "user_organizations_clients_select" ON "user_organizations";
DROP POLICY IF EXISTS "invoices_staff_all" ON "invoices";
DROP POLICY IF EXISTS "invoices_clients_select" ON "invoices";
DROP POLICY IF EXISTS "invoice_line_items_staff_all" ON "invoice_line_items";
DROP POLICY IF EXISTS "invoice_line_items_clients_select" ON "invoice_line_items";
DROP POLICY IF EXISTS "offers_staff_all" ON "offers";
DROP POLICY IF EXISTS "offers_clients_select" ON "offers";

--> statement-breakpoint
-- Step 2: Drop helper functions (will be recreated with new table/column names)
DROP FUNCTION IF EXISTS public.is_staff_user();
DROP FUNCTION IF EXISTS public.current_user_org_ids();

--> statement-breakpoint
-- Step 3: Rename organizations table to companies
ALTER TABLE "organizations" RENAME TO "companies";

--> statement-breakpoint
-- Step 4: Add type column (client | supplier | both)
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "type" text DEFAULT 'client' NOT NULL;

--> statement-breakpoint
-- Step 5: Rename organization_id to company_id in users
ALTER TABLE "users" RENAME COLUMN "organization_id" TO "company_id";

--> statement-breakpoint
-- Step 6: Rename organization_id to company_id in user_organizations, then rename table
ALTER TABLE "user_organizations" RENAME COLUMN "organization_id" TO "company_id";
ALTER TABLE "user_organizations" RENAME TO "user_companies";

--> statement-breakpoint
-- Step 7: Rename organization_id to company_id in projects, contracts, invoices
ALTER TABLE "projects" RENAME COLUMN "organization_id" TO "company_id";
ALTER TABLE "contracts" RENAME COLUMN "organization_id" TO "company_id";
ALTER TABLE "invoices" RENAME COLUMN "organization_id" TO "company_id";

--> statement-breakpoint
-- Step 8: Update FK constraint names (PostgreSQL keeps old names; optional for clarity)
-- The FKs still work - they reference the renamed table/columns

--> statement-breakpoint
-- Step 9: Recreate helper functions
CREATE OR REPLACE FUNCTION public.is_staff_user()
RETURNS boolean AS $$
  SELECT (
    (auth.jwt()->>'email')::text LIKE '%@jurre.me'
    OR EXISTS (
      SELECT 1 FROM public.users u
      JOIN public.companies c ON c.name = 'EXO' AND (u.company_id = c.id OR EXISTS (
        SELECT 1 FROM public.user_companies uc
        WHERE uc.user_id = u.id AND uc.company_id = c.id
      ))
      WHERE u.email = (auth.jwt()->>'email')
    )
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public;

--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.current_user_org_ids()
RETURNS SETOF uuid AS $$
  SELECT company_id FROM public.users
  WHERE email = (auth.jwt()->>'email') AND company_id IS NOT NULL
  UNION
  SELECT uc.company_id FROM public.user_companies uc
  JOIN public.users u ON u.id = uc.user_id
  WHERE u.email = (auth.jwt()->>'email');
$$ LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public;

--> statement-breakpoint
-- Step 10: Recreate RLS policies for companies
ALTER TABLE "companies" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "companies_staff_all" ON "companies" FOR ALL USING (public.is_staff_user());
CREATE POLICY "companies_clients_select" ON "companies" FOR SELECT USING (id IN (SELECT current_user_org_ids()));

--> statement-breakpoint
CREATE POLICY "users_staff_all" ON "users" FOR ALL USING (public.is_staff_user());
CREATE POLICY "users_clients_select" ON "users" FOR SELECT USING (
  email = (auth.jwt()->>'email')
  OR company_id IN (SELECT current_user_org_ids())
  OR id IN (SELECT uc.user_id FROM user_companies uc WHERE uc.company_id IN (SELECT current_user_org_ids()))
);

--> statement-breakpoint
CREATE POLICY "projects_staff_all" ON "projects" FOR ALL USING (public.is_staff_user());
CREATE POLICY "projects_clients_select" ON "projects" FOR SELECT USING (company_id IN (SELECT current_user_org_ids()));

--> statement-breakpoint
CREATE POLICY "deliverables_staff_all" ON "deliverables" FOR ALL USING (public.is_staff_user());
CREATE POLICY "deliverables_clients_select" ON "deliverables" FOR SELECT USING (
  project_id IN (SELECT id FROM projects WHERE company_id IN (SELECT current_user_org_ids()))
);

--> statement-breakpoint
CREATE POLICY "client_assets_staff_all" ON "client_assets" FOR ALL USING (public.is_staff_user());
CREATE POLICY "client_assets_clients_select" ON "client_assets" FOR SELECT USING (
  project_id IN (SELECT id FROM projects WHERE company_id IN (SELECT current_user_org_ids()))
);

--> statement-breakpoint
CREATE POLICY "contracts_staff_all" ON "contracts" FOR ALL USING (public.is_staff_user());
CREATE POLICY "contracts_clients_select" ON "contracts" FOR SELECT USING (company_id IN (SELECT current_user_org_ids()));

--> statement-breakpoint
CREATE POLICY "contract_projects_staff_all" ON "contract_projects" FOR ALL USING (public.is_staff_user());
CREATE POLICY "contract_projects_clients_select" ON "contract_projects" FOR SELECT USING (
  contract_id IN (SELECT id FROM contracts WHERE company_id IN (SELECT current_user_org_ids()))
  OR project_id IN (SELECT id FROM projects WHERE company_id IN (SELECT current_user_org_ids()))
);

--> statement-breakpoint
ALTER TABLE "user_companies" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_companies_staff_all" ON "user_companies" FOR ALL USING (public.is_staff_user());
CREATE POLICY "user_companies_clients_select" ON "user_companies" FOR SELECT USING (
  user_id IN (SELECT id FROM users WHERE email = (auth.jwt()->>'email'))
  OR company_id IN (SELECT current_user_org_ids())
);

--> statement-breakpoint
CREATE POLICY "invoices_staff_all" ON "invoices" FOR ALL USING (public.is_staff_user());
CREATE POLICY "invoices_clients_select" ON "invoices" FOR SELECT USING (company_id IN (SELECT current_user_org_ids()));

--> statement-breakpoint
CREATE POLICY "invoice_line_items_staff_all" ON "invoice_line_items" FOR ALL USING (public.is_staff_user());
CREATE POLICY "invoice_line_items_clients_select" ON "invoice_line_items" FOR SELECT USING (
  invoice_id IN (SELECT id FROM invoices WHERE company_id IN (SELECT current_user_org_ids()))
);

--> statement-breakpoint
CREATE POLICY "offers_staff_all" ON "offers" FOR ALL USING (public.is_staff_user());
CREATE POLICY "offers_clients_select" ON "offers" FOR SELECT USING (
  project_id IN (SELECT id FROM projects WHERE company_id IN (SELECT current_user_org_ids()))
  OR project_id IS NULL
);
