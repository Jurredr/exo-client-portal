# Company Detail Page & Table Enhancements

**Date:** 2026-04-13
**Status:** Approved

## Overview

Add a detail page per company and enhance the companies table with revenue and project count columns. The goal is to quickly see how valuable each company is from the table, and drill into full details on a dedicated page.

## 1. Organizations Table Enhancements

### New columns

| Column   | Data                                | Source                                                                  |
| -------- | ----------------------------------- | ----------------------------------------------------------------------- |
| Projects | Count of projects linked to company | `COUNT(projects) WHERE companyId = company.id`                          |
| Revenue  | All-time total of paid invoices     | `SUM(invoices.amount) WHERE companyId = company.id AND status = 'paid'` |

### Column order

Avatar → Name → Projects → Revenue → Contacts → Created → Actions

### Navigation change

Clicking a row navigates to `/dashboard/organizations/[id]` instead of opening the edit dialog. Edit remains accessible via the actions dropdown and from the detail page.

## 2. Detail Page

### Route

`/dashboard/organizations/[id]` — new Next.js page.

### Header

- Back button → `/dashboard/organizations`
- Company logo (Avatar) + name (large)
- "Edit" button that opens the existing edit dialog
- Contact info displayed below name: email, phone, address, KVK, BTW (if available)

### Stats Cards (row of 3)

1. **Revenue Paid** — all-time total of invoices with status `paid`
   - Subtitle: current year (2026) paid total
2. **Revenue Invoiced** — all-time total of invoices with status `sent` or `paid`
   - Subtitle: current year invoiced total
3. **Total Hours** — sum of all hour registrations via projects linked to this company
   - Subtitle: current year hours total

Format: `€X.XXX` for revenue, `Xh` for hours.

### Projects Table

All projects where `projects.companyId = company.id`:

| Column | Data                                                        |
| ------ | ----------------------------------------------------------- |
| Title  | Project title                                               |
| Status | Badge (active, completed, on_hold, cancelled, lead)         |
| Budget | `projects.subtotal` formatted as €X.XXX                     |
| Hours  | `SUM(hourRegistrations.hours) WHERE projectId = project.id` |

## 3. Data Architecture

### New API route

**`GET /api/organizations/[id]/details`**

Returns a single JSON response with:

- Company info (all fields)
- Projects array with hours per project
- Revenue aggregations: paid all-time, invoiced all-time, paid current year, invoiced current year
- Total hours all-time + current year

### New database query

`getCompanyDetails(companyId)` in `src/lib/db/queries.ts`:

1. Fetch company by ID
2. Fetch projects with `LEFT JOIN hourRegistrations` → `SUM(hours)` per project
3. Fetch invoice aggregations:
   - `SUM(amount) WHERE status = 'paid'` (all-time paid)
   - `SUM(amount) WHERE status IN ('sent', 'paid')` (all-time invoiced)
   - Same two with `WHERE YEAR(invoiceDate) = currentYear` filter

### Enhanced companies list query

Extend `getAllCompanies()` (or create a variant) to include per-company:

- `COUNT(projects)` as `projectCount`
- `SUM(invoices.amount) WHERE status = 'paid'` as `totalRevenue`

This prevents N+1 queries on the table page.

### New React Query hook

`useCompanyDetails(companyId)` in `src/hooks/use-company-details.ts`

### New component

`CompanyDetailPage.tsx` in `src/components/admin/` — renders the full detail page.

## 4. Files to Create

- `src/app/dashboard/organizations/[id]/page.tsx` — detail page route
- `src/components/admin/CompanyDetailPage.tsx` — detail page component
- `src/hooks/use-company-details.ts` — React Query hook
- `src/app/api/organizations/[id]/details/route.ts` — API route

## 5. Files to Modify

- `src/lib/db/queries.ts` — add `getCompanyDetails()`, enhance `getAllCompanies()`
- `src/components/admin/OrganizationsTable.tsx` — add columns, change row click to navigate
- `src/app/api/organizations/route.ts` — update GET to return enriched data (or keep separate)

## 6. Out of Scope

- Filtering/date range picker on the detail page (can be added later)
- Revenue charts or graphs
- Export functionality
- Editing projects from the company detail page
