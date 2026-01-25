"use client";

import { ExpensesTable } from "@/components/admin/ExpensesTable";
import { SiteHeader } from "@/components/site-header";

export default function ExpensesPage() {
  return (
    <>
      <SiteHeader title="Expenses" />
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
            <div className="px-4 lg:px-6">
              <ExpensesTable />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
