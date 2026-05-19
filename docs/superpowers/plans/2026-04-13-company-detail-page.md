# Company Detail Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add revenue, projects, and hours-worked stats per company — both as summary columns on the companies table and as a dedicated detail page.

**Architecture:** New `getCompanyDetails` and enhanced `getAllCompanies` queries aggregate invoice amounts and hour registrations via Drizzle ORM. A new API route `/api/organizations/[id]/details` serves the detail data. The detail page uses a new React Query hook and renders stats cards + a projects table. The existing organizations table gets two new columns and row-click navigation.

**Tech Stack:** Next.js App Router, Drizzle ORM (PostgreSQL), TanStack React Query, shadcn/ui components, TanStack Table, Tailwind CSS.

---

## File Map

| Action | File                                              | Responsibility                                                                      |
| ------ | ------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Modify | `src/lib/db/queries.ts`                           | Add `getCompanyDetails()`, enhance `getAllCompanies()` with project count + revenue |
| Create | `src/app/api/organizations/[id]/details/route.ts` | API endpoint for company detail data                                                |
| Create | `src/hooks/use-company-details.ts`                | React Query hook for company details                                                |
| Create | `src/app/dashboard/organizations/[id]/page.tsx`   | Next.js route for detail page                                                       |
| Create | `src/components/admin/CompanyDetailPage.tsx`      | Detail page UI component                                                            |
| Modify | `src/hooks/use-organizations.ts`                  | Update `OrganizationData` interface with new fields                                 |
| Modify | `src/components/admin/OrganizationsTable.tsx`     | Add columns, change row click to navigate                                           |

---

### Task 1: Enhance `getAllCompanies` query with project count and revenue

**Files:**

- Modify: `src/lib/db/queries.ts:745-785`

- [ ] **Step 1: Add project count aggregation**

After the existing `contactCounts` query (line 766-772), add a project count query:

```typescript
// Get project counts for each company
const projectCounts = await db
  .select({
    companyId: projects.companyId,
    count: sql<number>`COUNT(*)::int`.as("count"),
  })
  .from(projects)
  .groupBy(projects.companyId);

const projectCountMap: Record<string, number> = {};
projectCounts.forEach((row) => {
  projectCountMap[row.companyId] = row.count;
});
```

- [ ] **Step 2: Add paid revenue aggregation**

```typescript
// Get total paid revenue for each company
const revenueByCompany = await db
  .select({
    companyId: invoices.companyId,
    totalPaid:
      sql<string>`COALESCE(SUM(CAST(${invoices.amount} AS DECIMAL(12,2))), 0)::text`.as(
        "total_paid"
      ),
  })
  .from(invoices)
  .where(eq(invoices.status, "paid"))
  .groupBy(invoices.companyId);

const revenueMap: Record<string, string> = {};
revenueByCompany.forEach((row) => {
  revenueMap[row.companyId] = row.totalPaid;
});
```

- [ ] **Step 3: Include new fields in the return**

Change the return statement at line 781-784 to:

```typescript
return companyList.map((company) => ({
  ...company,
  contactCount: contactCountMap[company.id] || 0,
  projectCount: projectCountMap[company.id] || 0,
  totalRevenue: revenueMap[company.id] || "0",
}));
```

- [ ] **Step 4: Verify the build**

Run: `cd /Users/jurre/Desktop/EXO/Projects/EXO\ Labs/exo-client-portal && bun run build`
Expected: Build succeeds (no type errors — the return type is inferred)

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/queries.ts
git commit -m "feat: add project count and revenue to getAllCompanies query"
```

---

### Task 2: Add `getCompanyDetails` query

**Files:**

- Modify: `src/lib/db/queries.ts` (add after `getCompanyById` at ~line 795)

- [ ] **Step 1: Add the `getCompanyDetails` function**

Insert after the `getCompanyById` function:

```typescript
export async function getCompanyDetails(companyId: string) {
  // 1. Fetch company
  const company = await db
    .select()
    .from(companies)
    .where(eq(companies.id, companyId))
    .limit(1);

  if (!company[0]) return null;

  // 2. Fetch projects with hours per project
  const companyProjects = await db
    .select({
      id: projects.id,
      slug: projects.slug,
      title: projects.title,
      status: projects.status,
      subtotal: projects.subtotal,
      currency: projects.currency,
      type: projects.type,
      startDate: projects.startDate,
      deadline: projects.deadline,
      totalHours:
        sql<string>`COALESCE(SUM(CAST(${hourRegistrations.hours} AS DECIMAL(10,2))), 0)::text`.as(
          "total_hours"
        ),
    })
    .from(projects)
    .leftJoin(hourRegistrations, eq(hourRegistrations.projectId, projects.id))
    .where(eq(projects.companyId, companyId))
    .groupBy(
      projects.id,
      projects.slug,
      projects.title,
      projects.status,
      projects.subtotal,
      projects.currency,
      projects.type,
      projects.startDate,
      projects.deadline
    )
    .orderBy(desc(projects.createdAt));

  // 3. Fetch invoice aggregations
  const currentYear = new Date().getFullYear();
  const yearStart = new Date(currentYear, 0, 1); // Jan 1
  const yearEnd = new Date(currentYear + 1, 0, 1); // Jan 1 next year

  const invoiceAggregations = await db
    .select({
      paidAllTime:
        sql<string>`COALESCE(SUM(CASE WHEN ${invoices.status} = 'paid' THEN CAST(${invoices.amount} AS DECIMAL(12,2)) ELSE 0 END), 0)::text`.as(
          "paid_all_time"
        ),
      invoicedAllTime:
        sql<string>`COALESCE(SUM(CASE WHEN ${invoices.status} IN ('sent', 'paid') THEN CAST(${invoices.amount} AS DECIMAL(12,2)) ELSE 0 END), 0)::text`.as(
          "invoiced_all_time"
        ),
      paidCurrentYear:
        sql<string>`COALESCE(SUM(CASE WHEN ${invoices.status} = 'paid' AND ${invoices.invoiceDate} >= ${yearStart} AND ${invoices.invoiceDate} < ${yearEnd} THEN CAST(${invoices.amount} AS DECIMAL(12,2)) ELSE 0 END), 0)::text`.as(
          "paid_current_year"
        ),
      invoicedCurrentYear:
        sql<string>`COALESCE(SUM(CASE WHEN ${invoices.status} IN ('sent', 'paid') AND ${invoices.invoiceDate} >= ${yearStart} AND ${invoices.invoiceDate} < ${yearEnd} THEN CAST(${invoices.amount} AS DECIMAL(12,2)) ELSE 0 END), 0)::text`.as(
          "invoiced_current_year"
        ),
    })
    .from(invoices)
    .where(eq(invoices.companyId, companyId));

  const revenue = invoiceAggregations[0] ?? {
    paidAllTime: "0",
    invoicedAllTime: "0",
    paidCurrentYear: "0",
    invoicedCurrentYear: "0",
  };

  // 4. Calculate total hours
  const totalHoursAllTime = companyProjects.reduce(
    (sum, p) => sum + parseFloat(p.totalHours || "0"),
    0
  );

  // Hours for current year
  const currentYearHours = await db
    .select({
      total:
        sql<string>`COALESCE(SUM(CAST(${hourRegistrations.hours} AS DECIMAL(10,2))), 0)::text`.as(
          "total"
        ),
    })
    .from(hourRegistrations)
    .innerJoin(projects, eq(projects.id, hourRegistrations.projectId))
    .where(
      and(
        eq(projects.companyId, companyId),
        gte(hourRegistrations.date, yearStart),
        lte(hourRegistrations.date, yearEnd)
      )
    );

  return {
    company: company[0],
    projects: companyProjects,
    revenue,
    hours: {
      allTime: totalHoursAllTime.toFixed(2),
      currentYear: currentYearHours[0]?.total || "0",
    },
  };
}
```

- [ ] **Step 2: Verify the build**

Run: `cd /Users/jurre/Desktop/EXO/Projects/EXO\ Labs/exo-client-portal && bun run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/lib/db/queries.ts
git commit -m "feat: add getCompanyDetails query with projects, revenue, hours"
```

---

### Task 3: Create API route for company details

**Files:**

- Create: `src/app/api/organizations/[id]/details/route.ts`

- [ ] **Step 1: Create the API route**

```typescript
import { createClient } from "@/lib/supabase/server";
import { getCompanyDetails, isUserInEXOCompany } from "@/lib/db/queries";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user || !user.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isInEXO = await isUserInEXOCompany(user.email);
    if (!isInEXO) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const details = await getCompanyDetails(id);

    if (!details) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    return NextResponse.json(details, {
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    });
  } catch (error) {
    console.error("Error fetching company details:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Verify the build**

Run: `cd /Users/jurre/Desktop/EXO/Projects/EXO\ Labs/exo-client-portal && bun run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/app/api/organizations/\[id\]/details/route.ts
git commit -m "feat: add GET /api/organizations/[id]/details endpoint"
```

---

### Task 4: Create React Query hook for company details

**Files:**

- Create: `src/hooks/use-company-details.ts`

- [ ] **Step 1: Create the hook file**

```typescript
import { useQuery } from "@tanstack/react-query";
import { organizationKeys } from "./use-organizations";

interface CompanyProject {
  id: string;
  slug: string;
  title: string;
  status: string;
  subtotal: string | null;
  currency: string;
  type: string;
  startDate: string | null;
  deadline: string | null;
  totalHours: string;
}

interface CompanyRevenue {
  paidAllTime: string;
  invoicedAllTime: string;
  paidCurrentYear: string;
  invoicedCurrentYear: string;
}

interface CompanyHours {
  allTime: string;
  currentYear: string;
}

interface CompanyInfo {
  id: string;
  name: string;
  imageStoragePath: string | null;
  imageSizeBytes: number | null;
  address: string | null;
  kvkNumber: string | null;
  btwNumber: string | null;
  email: string | null;
  telephone: string | null;
  type: string;
  createdAt: string;
  updatedAt: string;
}

export interface CompanyDetails {
  company: CompanyInfo;
  projects: CompanyProject[];
  revenue: CompanyRevenue;
  hours: CompanyHours;
}

async function fetchCompanyDetails(id: string): Promise<CompanyDetails> {
  const response = await fetch(`/api/organizations/${id}/details`);
  if (!response.ok) {
    throw new Error("Failed to fetch company details");
  }
  return response.json();
}

export function useCompanyDetails(companyId: string) {
  return useQuery({
    queryKey: organizationKeys.detail(companyId),
    queryFn: () => fetchCompanyDetails(companyId),
    enabled: !!companyId,
    staleTime: 0,
  });
}
```

- [ ] **Step 2: Verify the build**

Run: `cd /Users/jurre/Desktop/EXO/Projects/EXO\ Labs/exo-client-portal && bun run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/hooks/use-company-details.ts
git commit -m "feat: add useCompanyDetails React Query hook"
```

---

### Task 5: Create the CompanyDetailPage component

**Files:**

- Create: `src/components/admin/CompanyDetailPage.tsx`

- [ ] **Step 1: Create the component file**

```typescript
"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { ColumnDef } from "@tanstack/react-table";
import { useCompanyDetails, CompanyDetails } from "@/hooks/use-company-details";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EnhancedDataTable } from "@/components/enhanced-data-table";
import { ArrowLeft, ArrowUpDown, Loader2, Pencil } from "lucide-react";

interface CompanyDetailPageProps {
  companyId: string;
}

const STATUS_COLORS: Record<string, string> = {
  lead: "bg-purple-500",
  active: "bg-green-500",
  completed: "bg-blue-500",
  on_hold: "bg-yellow-500",
  cancelled: "bg-red-500",
};

const STATUS_LABELS: Record<string, string> = {
  lead: "Discussing",
  active: "Active",
  completed: "Completed",
  on_hold: "On Hold",
  cancelled: "Cancelled",
};

function formatCurrency(amount: string | number): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(num)) return "€0";
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(num);
}

function formatHours(decimalHours: string | number): string {
  const num =
    typeof decimalHours === "string" ? parseFloat(decimalHours) : decimalHours;
  if (isNaN(num) || num === 0) return "0h";
  const totalMinutes = Math.round(num * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}min`);
  return parts.join(" ");
}

type CompanyProject = CompanyDetails["projects"][number];

export function CompanyDetailPage({ companyId }: CompanyDetailPageProps) {
  const router = useRouter();
  const { data, isLoading } = useCompanyDetails(companyId);

  const projectColumns: ColumnDef<CompanyProject>[] = useMemo(
    () => [
      {
        accessorKey: "title",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() =>
              column.toggleSorting(column.getIsSorted() === "asc")
            }
            className="-ml-3 h-8"
          >
            Title
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: ({ row }) => (
          <div className="font-medium">{row.original.title}</div>
        ),
        enableSorting: true,
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => {
          const status = row.original.status;
          return (
            <div className="flex items-center gap-2">
              <div
                className={`h-2 w-2 rounded-full ${STATUS_COLORS[status] || "bg-gray-500"}`}
              />
              <span className="text-sm">
                {STATUS_LABELS[status] || status}
              </span>
            </div>
          );
        },
        enableSorting: true,
      },
      {
        accessorKey: "subtotal",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() =>
              column.toggleSorting(column.getIsSorted() === "asc")
            }
            className="-ml-3 h-8"
          >
            Budget
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: ({ row }) => {
          const subtotal = row.original.subtotal;
          if (!subtotal) return <span className="text-muted-foreground">—</span>;
          return <div>{formatCurrency(subtotal)}</div>;
        },
        enableSorting: true,
        sortingFn: (rowA, rowB) => {
          const a = parseFloat(rowA.original.subtotal || "0");
          const b = parseFloat(rowB.original.subtotal || "0");
          return a - b;
        },
      },
      {
        accessorKey: "totalHours",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() =>
              column.toggleSorting(column.getIsSorted() === "asc")
            }
            className="-ml-3 h-8"
          >
            Hours
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: ({ row }) => (
          <div>{formatHours(row.original.totalHours)}</div>
        ),
        enableSorting: true,
        sortingFn: (rowA, rowB) => {
          const a = parseFloat(rowA.original.totalHours || "0");
          const b = parseFloat(rowB.original.totalHours || "0");
          return a - b;
        },
      },
    ],
    []
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4">
        <p className="text-muted-foreground">Company not found</p>
        <Button
          variant="outline"
          onClick={() => router.push("/dashboard/organizations")}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Companies
        </Button>
      </div>
    );
  }

  const { company, projects: companyProjects, revenue, hours } = data;
  const currentYear = new Date().getFullYear();

  const getInitials = (name: string) =>
    name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/dashboard/organizations")}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Avatar className="h-14 w-14">
          <AvatarImage
            src={
              company.imageStoragePath
                ? `/api/organizations/${company.id}/image`
                : undefined
            }
            alt={company.name}
          />
          <AvatarFallback className="text-lg">
            {getInitials(company.name)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{company.name}</h1>
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/dashboard/organizations?edit=${company.id}`)}
            >
              <Pencil className="h-3.5 w-3.5 mr-1.5" />
              Edit
            </Button>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground mt-1">
            {company.email && <span>{company.email}</span>}
            {company.telephone && <span>{company.telephone}</span>}
            {company.address && <span>{company.address}</span>}
            {company.kvkNumber && <span>KVK: {company.kvkNumber}</span>}
            {company.btwNumber && <span>BTW: {company.btwNumber}</span>}
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Revenue Paid
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(revenue.paidAllTime)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {formatCurrency(revenue.paidCurrentYear)} in {currentYear}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Revenue Invoiced
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(revenue.invoicedAllTime)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {formatCurrency(revenue.invoicedCurrentYear)} in {currentYear}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Hours
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatHours(hours.allTime)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {formatHours(hours.currentYear)} in {currentYear}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Projects Table */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Projects</h2>
        <EnhancedDataTable
          columns={projectColumns}
          data={companyProjects}
          searchPlaceholder="Search projects..."
          searchableFields={["title"]}
          initialSorting={[{ id: "title", desc: false }]}
          emptyMessage="No projects found for this company."
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify the build**

Run: `cd /Users/jurre/Desktop/EXO/Projects/EXO\ Labs/exo-client-portal && bun run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/CompanyDetailPage.tsx
git commit -m "feat: add CompanyDetailPage component with stats and projects table"
```

---

### Task 6: Create the detail page route

**Files:**

- Create: `src/app/dashboard/organizations/[id]/page.tsx`

- [ ] **Step 1: Create the page file**

```typescript
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
```

- [ ] **Step 2: Verify the build**

Run: `cd /Users/jurre/Desktop/EXO/Projects/EXO\ Labs/exo-client-portal && bun run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/organizations/\[id\]/page.tsx
git commit -m "feat: add /dashboard/organizations/[id] route"
```

---

### Task 7: Update OrganizationsTable with new columns and navigation

**Files:**

- Modify: `src/hooks/use-organizations.ts:54-66` (update interface)
- Modify: `src/components/admin/OrganizationsTable.tsx:54-68` (update interface)
- Modify: `src/components/admin/OrganizationsTable.tsx:137-291` (add columns, change navigation)

- [ ] **Step 1: Update the Organization interface in use-organizations.ts**

Add the new fields to the `OrganizationData` interface:

```typescript
interface OrganizationData {
  id: string;
  name: string;
  imageStoragePath: string | null;
  imageSizeBytes: number | null;
  address: string | null;
  kvkNumber: string | null;
  btwNumber: string | null;
  email: string | null;
  telephone: string | null;
  createdAt: string;
  updatedAt: string;
  userCount?: number;
  contactCount?: number;
  projectCount?: number;
  totalRevenue?: string;
}
```

- [ ] **Step 2: Update the Organization interface in OrganizationsTable.tsx**

Add the new fields:

```typescript
interface Organization {
  id: string;
  name: string;
  imageStoragePath: string | null;
  imageSizeBytes: number | null;
  address?: string | null;
  kvkNumber?: string | null;
  btwNumber?: string | null;
  email?: string | null;
  telephone?: string | null;
  createdAt: string;
  updatedAt: string;
  userCount?: number;
  contactCount?: number;
  projectCount?: number;
  totalRevenue?: string;
}
```

- [ ] **Step 3: Add the `useRouter` import and hook**

Add to imports at the top of `OrganizationsTable.tsx`:

```typescript
import { useRouter } from "next/navigation";
```

Add inside the component, after the existing hooks:

```typescript
const router = useRouter();
```

- [ ] **Step 4: Add Projects and Revenue columns**

Insert two new column definitions after the `name` column (after line ~188) and before `contactCount`:

```typescript
{
  accessorKey: "projectCount",
  header: ({ column }) => {
    return (
      <Button
        variant="ghost"
        onClick={() =>
          column.toggleSorting(column.getIsSorted() === "asc")
        }
        className="-ml-3 h-8"
      >
        Projects
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    );
  },
  cell: ({ row }) => {
    const count = row.original.projectCount || 0;
    return <div className="font-medium">{count}</div>;
  },
  enableSorting: true,
},
{
  accessorKey: "totalRevenue",
  header: ({ column }) => {
    return (
      <Button
        variant="ghost"
        onClick={() =>
          column.toggleSorting(column.getIsSorted() === "asc")
        }
        className="-ml-3 h-8"
      >
        Revenue
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    );
  },
  cell: ({ row }) => {
    const revenue = row.original.totalRevenue || "0";
    const num = parseFloat(revenue);
    if (isNaN(num) || num === 0)
      return <span className="text-muted-foreground">€0</span>;
    return (
      <div className="font-medium">
        {new Intl.NumberFormat("nl-NL", {
          style: "currency",
          currency: "EUR",
          minimumFractionDigits: 0,
          maximumFractionDigits: 2,
        }).format(num)}
      </div>
    );
  },
  enableSorting: true,
  sortingFn: (rowA, rowB) => {
    const a = parseFloat(rowA.original.totalRevenue || "0");
    const b = parseFloat(rowB.original.totalRevenue || "0");
    return a - b;
  },
},
```

- [ ] **Step 5: Change row click to navigate to detail page**

Replace the `handleRowClick` function (~line 295-298):

```typescript
const handleRowClick = (org: Organization) => {
  router.push(`/dashboard/organizations/${org.id}`);
};
```

- [ ] **Step 6: Verify the build**

Run: `cd /Users/jurre/Desktop/EXO/Projects/EXO\ Labs/exo-client-portal && bun run build`
Expected: Build succeeds

- [ ] **Step 7: Test in browser**

Run the dev server (`bun run dev`) and verify:

1. Organizations table shows new Projects and Revenue columns
2. Clicking a row navigates to `/dashboard/organizations/[id]`
3. Detail page shows company header, stats cards, and projects table
4. Back button returns to the organizations table
5. Edit still works via the actions dropdown

- [ ] **Step 8: Commit**

```bash
git add src/hooks/use-organizations.ts src/components/admin/OrganizationsTable.tsx
git commit -m "feat: add projects/revenue columns to companies table, navigate to detail page on row click"
```
