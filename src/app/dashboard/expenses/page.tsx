import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { isUserInEXOOrganization } from "@/lib/db/queries";
import { AppSidebar } from "@/components/app-sidebar";
import { ExpensesTable } from "@/components/admin/ExpensesTable";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

export default async function ExpensesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.email) {
    redirect("/login");
  }

  const isInEXO = await isUserInEXOOrganization(user.email);
  if (!isInEXO) {
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
        <SiteHeader title="Expenses" />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
              <div className="px-4 lg:px-6">
                <div className="mb-6">
                  <h1 className="text-3xl font-bold">Expenses</h1>
                  <p className="text-muted-foreground">
                    Track and manage business expenses
                  </p>
                </div>
                <div className="space-y-6">
                  <ExpensesTable />
                </div>
              </div>
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

