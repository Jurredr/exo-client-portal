"use client";

import { ProjectsTable } from "@/components/admin/ProjectsTable";
import { ProjectStatsCards } from "@/components/admin/ProjectStatsCards";
import { SiteHeader } from "@/components/site-header";

export default function ProjectsPage() {
  return (
    <>
      <SiteHeader title="Projects" />
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
            <div className="px-4 lg:px-6">
              <div className="mb-6">
                <h1 className="text-3xl font-bold">Projects</h1>
                <p className="text-muted-foreground">
                  Manage projects and track time spent
                </p>
              </div>
              <div className="space-y-6">
                <ProjectStatsCards />
                <ProjectsTable />
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
