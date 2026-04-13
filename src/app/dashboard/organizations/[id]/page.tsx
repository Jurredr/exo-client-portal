"use client";

import { use } from "react";
import { CompanyDetailPage } from "@/components/admin/CompanyDetailPage";
import { SiteHeader } from "@/components/site-header";

export default function OrganizationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  return (
    <>
      <SiteHeader title="Company Details" />
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
            <div className="px-4 lg:px-6">
              <CompanyDetailPage companyId={id} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
