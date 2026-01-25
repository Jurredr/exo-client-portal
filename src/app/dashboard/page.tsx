"use client";

import { SiteHeader } from "@/components/site-header";
import DashboardStats from "@/components/admin/DashboardStats";

export default function DashboardPage() {
  return (
    <>
      <SiteHeader title="Dashboard" />
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
            <div className="px-4 lg:px-6">
              <div className="mb-6">
                <h1 className="text-3xl font-bold">EXO Dashboard</h1>
                <p className="text-muted-foreground">
                  Manage organizations, clients, projects, and track hours
                </p>
              </div>
              <DashboardStats />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
