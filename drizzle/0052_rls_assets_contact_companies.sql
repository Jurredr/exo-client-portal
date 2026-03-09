-- Enable RLS on assets and contact_companies (both staff-only, like expenses and contacts)

--> statement-breakpoint
ALTER TABLE "assets" ENABLE ROW LEVEL SECURITY;

--> statement-breakpoint
CREATE POLICY "assets_staff_all" ON "assets" FOR ALL USING (public.is_staff_user());

--> statement-breakpoint
ALTER TABLE "contact_companies" ENABLE ROW LEVEL SECURITY;

--> statement-breakpoint
CREATE POLICY "contact_companies_staff_all" ON "contact_companies" FOR ALL USING (public.is_staff_user());
