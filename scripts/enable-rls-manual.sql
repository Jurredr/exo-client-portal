-- Run this in Supabase Dashboard > SQL Editor
-- This enables RLS on all tables and adds policies.
-- Drizzle migrations may fail when using the Transaction pooler (port 6543);
-- running here ensures it executes in the correct Supabase context.

-- Helper: current user's email from JWT (null if not authenticated)
CREATE OR REPLACE FUNCTION public.current_user_email()
RETURNS text AS $$
  SELECT auth.jwt()->>'email';
$$ LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public;

-- Helper: true if current user is admin (email ends with @jurre.me) or in EXO org
CREATE OR REPLACE FUNCTION public.is_staff_user()
RETURNS boolean AS $$
  SELECT (
    (auth.jwt()->>'email')::text LIKE '%@jurre.me'
    OR EXISTS (
      SELECT 1 FROM public.users u
      JOIN public.organizations o ON o.name = 'EXO' AND (u.organization_id = o.id OR EXISTS (
        SELECT 1 FROM public.user_organizations uo
        WHERE uo.user_id = u.id AND uo.organization_id = o.id
      ))
      WHERE u.email = (auth.jwt()->>'email')
    )
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public;

-- Helper: org IDs the current user belongs to (for client scoping)
CREATE OR REPLACE FUNCTION public.current_user_org_ids()
RETURNS SETOF uuid AS $$
  SELECT organization_id FROM public.users
  WHERE email = (auth.jwt()->>'email') AND organization_id IS NOT NULL
  UNION
  SELECT uo.organization_id FROM public.user_organizations uo
  JOIN public.users u ON u.id = uo.user_id
  WHERE u.email = (auth.jwt()->>'email');
$$ LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public;

-- Enable RLS on all tables
ALTER TABLE "organizations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "projects" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "deliverables" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "client_assets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "contracts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "contract_projects" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "user_organizations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "hour_registrations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "expenses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "invoices" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "invoice_line_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "offers" ENABLE ROW LEVEL SECURITY;

-- organizations
CREATE POLICY "organizations_staff_all" ON "organizations" FOR ALL USING (public.is_staff_user());
CREATE POLICY "organizations_clients_select" ON "organizations" FOR SELECT USING (id IN (SELECT current_user_org_ids()));

-- users
CREATE POLICY "users_staff_all" ON "users" FOR ALL USING (public.is_staff_user());
CREATE POLICY "users_clients_select" ON "users" FOR SELECT USING (
  email = (auth.jwt()->>'email')
  OR organization_id IN (SELECT current_user_org_ids())
  OR id IN (SELECT uo.user_id FROM user_organizations uo WHERE uo.organization_id IN (SELECT current_user_org_ids()))
);

-- projects
CREATE POLICY "projects_staff_all" ON "projects" FOR ALL USING (public.is_staff_user());
CREATE POLICY "projects_clients_select" ON "projects" FOR SELECT USING (organization_id IN (SELECT current_user_org_ids()));

-- deliverables
CREATE POLICY "deliverables_staff_all" ON "deliverables" FOR ALL USING (public.is_staff_user());
CREATE POLICY "deliverables_clients_select" ON "deliverables" FOR SELECT USING (
  project_id IN (SELECT id FROM projects WHERE organization_id IN (SELECT current_user_org_ids()))
);

-- client_assets
CREATE POLICY "client_assets_staff_all" ON "client_assets" FOR ALL USING (public.is_staff_user());
CREATE POLICY "client_assets_clients_select" ON "client_assets" FOR SELECT USING (
  project_id IN (SELECT id FROM projects WHERE organization_id IN (SELECT current_user_org_ids()))
);

-- contracts
CREATE POLICY "contracts_staff_all" ON "contracts" FOR ALL USING (public.is_staff_user());
CREATE POLICY "contracts_clients_select" ON "contracts" FOR SELECT USING (organization_id IN (SELECT current_user_org_ids()));

-- contract_projects
CREATE POLICY "contract_projects_staff_all" ON "contract_projects" FOR ALL USING (public.is_staff_user());
CREATE POLICY "contract_projects_clients_select" ON "contract_projects" FOR SELECT USING (
  contract_id IN (SELECT id FROM contracts WHERE organization_id IN (SELECT current_user_org_ids()))
  OR project_id IN (SELECT id FROM projects WHERE organization_id IN (SELECT current_user_org_ids()))
);

-- user_organizations
CREATE POLICY "user_organizations_staff_all" ON "user_organizations" FOR ALL USING (public.is_staff_user());
CREATE POLICY "user_organizations_clients_select" ON "user_organizations" FOR SELECT USING (
  user_id IN (SELECT id FROM users WHERE email = (auth.jwt()->>'email'))
  OR organization_id IN (SELECT current_user_org_ids())
);

-- hour_registrations (staff only)
CREATE POLICY "hour_registrations_staff_all" ON "hour_registrations" FOR ALL USING (public.is_staff_user());

-- expenses (staff only)
CREATE POLICY "expenses_staff_all" ON "expenses" FOR ALL USING (public.is_staff_user());

-- invoices
CREATE POLICY "invoices_staff_all" ON "invoices" FOR ALL USING (public.is_staff_user());
CREATE POLICY "invoices_clients_select" ON "invoices" FOR SELECT USING (organization_id IN (SELECT current_user_org_ids()));

-- invoice_line_items
CREATE POLICY "invoice_line_items_staff_all" ON "invoice_line_items" FOR ALL USING (public.is_staff_user());
CREATE POLICY "invoice_line_items_clients_select" ON "invoice_line_items" FOR SELECT USING (
  invoice_id IN (SELECT id FROM invoices WHERE organization_id IN (SELECT current_user_org_ids()))
);

-- offers
CREATE POLICY "offers_staff_all" ON "offers" FOR ALL USING (public.is_staff_user());
CREATE POLICY "offers_clients_select" ON "offers" FOR SELECT USING (
  project_id IN (SELECT id FROM projects WHERE organization_id IN (SELECT current_user_org_ids()))
  OR project_id IS NULL
);
