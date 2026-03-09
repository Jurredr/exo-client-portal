"use client";

import { AssetsTable } from "@/components/admin/AssetsTable";
import { SiteHeader } from "@/components/site-header";

export default function AssetsPage() {
  return (
    <>
      <SiteHeader title="Assets" />
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
            <div className="px-4 lg:px-6">
              <AssetsTable />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
