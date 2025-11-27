import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/db/queries";
import { AppSidebar } from "@/components/app-sidebar";
import { HourRegistrationTimer } from "@/components/HourRegistrationTimer";
import { HourRegistrationsTable } from "@/components/admin/HourRegistrationsTable";
import { HourStatsCards } from "@/components/admin/HourStatsCards";
import { HourChart } from "@/components/admin/HourChart";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

export default async function HoursPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.email) {
    redirect("/login");
  }

  if (!isAdmin(user.email)) {
    redirect("/unauthorized");
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader title="Hour Registration" />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
              <div className="px-4 lg:px-6">
                <div className="mb-6">
                  <h1 className="text-3xl font-bold">Hour Registration</h1>
                  <p className="text-muted-foreground">
                    Track your work hours and log time entries
                  </p>
                </div>
                <div className="space-y-6">
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    <div className="lg:col-span-1">
                      <HourRegistrationTimer />
                    </div>
                  </div>
                  <HourStatsCards />
                  <HourChart />
                  <HourRegistrationsTable />
                </div>
              </div>
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
