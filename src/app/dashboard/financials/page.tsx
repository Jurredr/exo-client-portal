"use client";

import { SiteHeader } from "@/components/site-header";
import FinancialsOverview from "@/components/admin/FinancialsOverview";
import { BTWDeadlineBanner } from "@/components/admin/BTWDeadlineBanner";

export default function FinancialsPage() {
  return (
    <>
      <SiteHeader title="Financials" />
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
            <div className="px-4 lg:px-6">
              <div className="mb-6">
                <h1 className="text-3xl font-bold">Financials</h1>
                <p className="text-muted-foreground">
                  Revenue, expenses, profit margins, Dutch tax, and financial
                  statistics
                </p>
              </div>
              <BTWDeadlineBanner />
              <FinancialsOverview />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
