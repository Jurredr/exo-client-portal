# Project Tax Percentage

Add a per-project `taxPercentage` field so VAT is configurable per project instead of using a global constant. This tax percentage flows into the public project page and pre-fills invoice line items.

## Schema Change

Add `taxPercentage` column to the `projects` table:

- **Column**: `taxPercentage` (text, nullable)
- **Default**: `"21"` (standard Dutch VAT)
- **Migration**: New Drizzle migration file

Existing projects without a value fall back to 21%.

## Project Create & Edit Forms

### CreateProjectForm (`src/components/admin/CreateProjectForm.tsx`)

- Add "Tax %" number input field
- Default value: `21`
- Only visible for client projects (labs projects don't have invoices)
- Submitted alongside other project fields to the API

### ProjectsTable edit dialog (`src/components/admin/ProjectsTable.tsx`)

- Add "Tax %" input to the edit dialog/drawer
- Pre-filled with the project's current `taxPercentage` or `21` if null

### API routes

- `POST /api/projects` — accept and store `taxPercentage`
- `PATCH /api/projects/[id]` — accept and update `taxPercentage`
- Existing GET endpoints return `taxPercentage` as part of project data (already covered by `select *`)

## Public Project Page (`ProjectDetails.tsx`)

- Read `project.taxPercentage` (fallback to 21)
- Pass to `calculateVAT()` and `calculateTotal()` instead of using global `VAT_PERCENTAGE`
- Tooltip displays the project's actual tax percentage

### Currency utils (`src/lib/utils/currency.ts`)

- `calculateVAT(subtotal, currency, taxPercentage?)` — optional param, defaults to `VAT_PERCENTAGE`
- `calculateTotal(subtotal, currency, taxPercentage?)` — same
- `calculatePaymentAmount(subtotal, stage, currency, taxPercentage?)` — same
- Existing callers without the param continue to work unchanged

## Invoice Creation Pre-fill (`CreateInvoiceForm.tsx`)

When a project is selected in the invoice creation form:

1. Pre-fill **one line item** with:
   - `description` = project title
   - `quantity` = `"1"`
   - `unitPrice` = project subtotal
   - `taxPercentage` = project's `taxPercentage` (or `"21"` if null)
2. User can freely edit this item and add/remove additional items
3. KOR and reimbursement overrides still apply (set tax to 0%)

## What doesn't change

- `VAT_PERCENTAGE` constant remains as a global fallback
- Existing invoice line items keep their stored tax percentages
- KOR/reimbursement logic in invoice form continues to override tax to 0%
- Invoice PDF generation uses line item tax percentages (already per-item)

## Files to modify

1. `src/db/schema.ts` — add `taxPercentage` column
2. `drizzle/` — new migration
3. `src/components/admin/CreateProjectForm.tsx` — add tax % input
4. `src/components/admin/ProjectsTable.tsx` — add tax % to edit dialog
5. `src/app/api/projects/route.ts` — accept taxPercentage in POST
6. `src/app/api/projects/[id]/route.ts` — accept taxPercentage in PATCH (if exists)
7. `src/lib/utils/currency.ts` — add optional taxPercentage param to calc functions
8. `src/components/ProjectDetails.tsx` — use project's taxPercentage
9. `src/components/admin/CreateInvoiceForm.tsx` — pre-fill line item on project select
10. `src/types/project.ts` — add taxPercentage to Project type (if separate from schema)
