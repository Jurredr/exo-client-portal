"use client";

import { OffersTable } from "@/components/admin/OffersTable";
import { SiteHeader } from "@/components/site-header";

export default function OffersPage() {
  return (
    <>
      <SiteHeader title="Offers" />
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
            <div className="px-4 lg:px-6">
              <OffersTable />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
