-- Enable Row Level Security (RLS) on all tables
-- Policies allow: staff (admin/EXO) full access, clients read-only access to their org's data
-- Service role and postgres superuser bypass RLS by default

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

--> statement-breakpoint
ALTER TABLE "organizations" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "projects" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "deliverables" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "client_assets" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "contracts" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "contract_projects" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "user_organizations" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "hour_registrations" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "expenses" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "invoices" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "invoice_line_items" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "offers" ENABLE ROW LEVEL SECURITY;

--> statement-breakpoint
-- organizations: staff full access; clients SELECT their orgs
CREATE POLICY "organizations_staff_all" ON "organizations" FOR ALL USING (public.is_staff_user());
CREATE POLICY "organizations_clients_select" ON "organizations" FOR SELECT USING (id IN (SELECT current_user_org_ids()));

--> statement-breakpoint
-- users: staff full access; clients SELECT own row + users in their orgs
CREATE POLICY "users_staff_all" ON "users" FOR ALL USING (public.is_staff_user());
CREATE POLICY "users_clients_select" ON "users" FOR SELECT USING (
  email = (auth.jwt()->>'email')
  OR organization_id IN (SELECT current_user_org_ids())
  OR id IN (SELECT uo.user_id FROM user_organizations uo WHERE uo.organization_id IN (SELECT current_user_org_ids()))
);

--> statement-breakpoint
-- projects: staff full access; clients SELECT projects for their orgs
CREATE POLICY "projects_staff_all" ON "projects" FOR ALL USING (public.is_staff_user());
CREATE POLICY "projects_clients_select" ON "projects" FOR SELECT USING (organization_id IN (SELECT current_user_org_ids()));

--> statement-breakpoint
-- deliverables: staff full access; clients SELECT via project
CREATE POLICY "deliverables_staff_all" ON "deliverables" FOR ALL USING (public.is_staff_user());
CREATE POLICY "deliverables_clients_select" ON "deliverables" FOR SELECT USING (
  project_id IN (SELECT id FROM projects WHERE organization_id IN (SELECT current_user_org_ids()))
);

--> statement-breakpoint
-- client_assets: staff full access; clients SELECT via project
CREATE POLICY "client_assets_staff_all" ON "client_assets" FOR ALL USING (public.is_staff_user());
CREATE POLICY "client_assets_clients_select" ON "client_assets" FOR SELECT USING (
  project_id IN (SELECT id FROM projects WHERE organization_id IN (SELECT current_user_org_ids()))
);

--> statement-breakpoint
-- contracts: staff full access; clients SELECT contracts for their orgs
CREATE POLICY "contracts_staff_all" ON "contracts" FOR ALL USING (public.is_staff_user());
CREATE POLICY "contracts_clients_select" ON "contracts" FOR SELECT USING (organization_id IN (SELECT current_user_org_ids()));

--> statement-breakpoint
-- contract_projects: staff full access; clients SELECT via contract or project
CREATE POLICY "contract_projects_staff_all" ON "contract_projects" FOR ALL USING (public.is_staff_user());
CREATE POLICY "contract_projects_clients_select" ON "contract_projects" FOR SELECT USING (
  contract_id IN (SELECT id FROM contracts WHERE organization_id IN (SELECT current_user_org_ids()))
  OR project_id IN (SELECT id FROM projects WHERE organization_id IN (SELECT current_user_org_ids()))
);

--> statement-breakpoint
-- user_organizations: staff full access; clients SELECT their own memberships
CREATE POLICY "user_organizations_staff_all" ON "user_organizations" FOR ALL USING (public.is_staff_user());
CREATE POLICY "user_organizations_clients_select" ON "user_organizations" FOR SELECT USING (
  user_id IN (SELECT id FROM users WHERE email = (auth.jwt()->>'email'))
  OR organization_id IN (SELECT current_user_org_ids())
);

--> statement-breakpoint
-- hour_registrations: staff only (admin table)
CREATE POLICY "hour_registrations_staff_all" ON "hour_registrations" FOR ALL USING (public.is_staff_user());

--> statement-breakpoint
-- expenses: staff only (admin table)
CREATE POLICY "expenses_staff_all" ON "expenses" FOR ALL USING (public.is_staff_user());

--> statement-breakpoint
-- invoices: staff full access; clients SELECT invoices for their orgs
CREATE POLICY "invoices_staff_all" ON "invoices" FOR ALL USING (public.is_staff_user());
CREATE POLICY "invoices_clients_select" ON "invoices" FOR SELECT USING (organization_id IN (SELECT current_user_org_ids()));

--> statement-breakpoint
-- invoice_line_items: staff full access; clients SELECT via invoice
CREATE POLICY "invoice_line_items_staff_all" ON "invoice_line_items" FOR ALL USING (public.is_staff_user());
CREATE POLICY "invoice_line_items_clients_select" ON "invoice_line_items" FOR SELECT USING (
  invoice_id IN (SELECT id FROM invoices WHERE organization_id IN (SELECT current_user_org_ids()))
);

--> statement-breakpoint
-- offers: staff full access; clients SELECT via project
CREATE POLICY "offers_staff_all" ON "offers" FOR ALL USING (public.is_staff_user());
CREATE POLICY "offers_clients_select" ON "offers" FOR SELECT USING (
  project_id IN (SELECT id FROM projects WHERE organization_id IN (SELECT current_user_org_ids()))
  OR project_id IS NULL
);
