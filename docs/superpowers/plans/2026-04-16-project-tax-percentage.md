# Project Tax Percentage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a per-project `taxPercentage` field that flows into the public project page and pre-fills invoice line items when a project is selected.

**Architecture:** New `tax_percentage` column on the `projects` table (text, nullable, defaults to `"21"`). Currency utility functions gain an optional `taxPercentage` parameter. The invoice creation form pre-fills one line item from the selected project's data.

**Tech Stack:** Drizzle ORM, Next.js App Router, React, shadcn/ui

---

### Task 1: Database schema and migration

**Files:**

- Modify: `src/db/schema.ts:61-78`
- Create: `drizzle/0054_*.sql` (via drizzle-kit generate)

- [ ] **Step 1: Add `taxPercentage` column to projects table**

In `src/db/schema.ts`, add `taxPercentage` after the `currency` field:

```typescript
  currency: text("currency").notNull().default("EUR"), // USD, EUR
  taxPercentage: text("tax_percentage").default("21"), // VAT percentage, defaults to 21%
  type: text("type").notNull().default("client"), // client, labs
```

- [ ] **Step 2: Generate the migration**

Run: `bunx drizzle-kit generate`
Expected: New migration file created in `drizzle/` directory

- [ ] **Step 3: Apply the migration**

Run: `bunx drizzle-kit push`
Expected: Migration applied, `tax_percentage` column added to `projects` table

- [ ] **Step 4: Commit**

```bash
git add src/db/schema.ts drizzle/
git commit -m "feat: add taxPercentage column to projects table"
```

---

### Task 2: Currency utility functions — add optional `taxPercentage` parameter

**Files:**

- Modify: `src/lib/utils/currency.ts:93-137`

- [ ] **Step 1: Update `calculateVAT` signature**

In `src/lib/utils/currency.ts`, update the function at line 93:

```typescript
export function calculateVAT(
  subtotal: string | null | undefined,
  currency: string = "EUR",
  taxPercentage: number = VAT_PERCENTAGE
): string {
  const subtotalValue = parseNumeric(subtotal);
  const vat = subtotalValue * (taxPercentage / 100);
  return formatCurrency(vat, currency);
}
```

- [ ] **Step 2: Update `calculateTotal` signature**

Update the function at line 102:

```typescript
export function calculateTotal(
  subtotal: string | null | undefined,
  currency: string = "EUR",
  taxPercentage: number = VAT_PERCENTAGE
): string {
  const subtotalValue = parseNumeric(subtotal);
  const vat = subtotalValue * (taxPercentage / 100);
  const total = subtotalValue + vat;
  return formatCurrency(total, currency);
}
```

- [ ] **Step 3: Update `calculatePaymentAmount` signature**

Update the function at line 112:

```typescript
export function calculatePaymentAmount(
  subtotal: string | null | undefined,
  stage: string | null | undefined,
  currency: string = "EUR",
  taxPercentage: number = VAT_PERCENTAGE
): string | null {
  const symbol = currency === "USD" ? "$" : "€";
  if (!subtotal) return `${symbol}0`;
  const subtotalValue = parseNumeric(subtotal);
  const total = subtotalValue * (1 + taxPercentage / 100);

  // Payment amount depends on the project stage
  switch (stage) {
    case "pay_first":
      // First payment is 50% of total
      return formatCurrency(total * 0.5, currency);
    case "pay_final":
      // Final payment is 50% of total
      return formatCurrency(total * 0.5, currency);
```

(rest of switch remains unchanged)

- [ ] **Step 4: Verify build**

Run: `bun run build`
Expected: No type errors. All existing callers use defaults so nothing breaks.

- [ ] **Step 5: Commit**

```bash
git add src/lib/utils/currency.ts
git commit -m "feat: add optional taxPercentage param to currency utils"
```

---

### Task 3: Project creation form — add Tax % input

**Files:**

- Modify: `src/components/admin/CreateProjectForm.tsx`

- [ ] **Step 1: Add `taxPercentage` state**

Add after the existing `currency` state (around line 44):

```typescript
const [taxPercentage, setTaxPercentage] = useState("21");
```

- [ ] **Step 2: Include `taxPercentage` in mutation payload**

In the submit handler (around line 106), add `taxPercentage` to the mutation object. Find where `currency` is included and add after it:

```typescript
taxPercentage: projectType === "client" ? taxPercentage || "21" : null,
```

- [ ] **Step 3: Reset `taxPercentage` in form reset**

In the `onSuccess` callback (around line 119), add:

```typescript
setTaxPercentage("21");
```

- [ ] **Step 4: Add Tax % input field to the form**

Add the Tax % input next to the Currency field, inside the same row as Subtotal/Currency (the section that's only visible for client projects). Find the Subtotal + Currency section (around lines 249-281) and add Tax % as a third field in that row. Replace the existing subtotal/currency grid with a 3-column grid:

```tsx
{
  projectType === "client" && (
    <div className="grid grid-cols-3 gap-4">
      <div className="col-span-1">
        <Label htmlFor="project-subtotal">Subtotal</Label>
        <Input
          id="project-subtotal"
          type="number"
          step="0.01"
          placeholder="0.00"
          value={subtotal}
          onChange={(e) => setSubtotal(e.target.value)}
        />
      </div>
      <div>
        <Label htmlFor="project-currency">Currency</Label>
        <Select value={currency} onValueChange={setCurrency}>
          <SelectTrigger id="project-currency">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="EUR">EUR (€)</SelectItem>
            <SelectItem value="USD">USD ($)</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label htmlFor="project-tax">Tax %</Label>
        <Input
          id="project-tax"
          type="number"
          step="1"
          min="0"
          max="100"
          placeholder="21"
          value={taxPercentage}
          onChange={(e) => setTaxPercentage(e.target.value)}
        />
      </div>
    </div>
  );
}
```

Note: Check the exact existing JSX structure for Subtotal/Currency and adapt accordingly — the existing layout may use a 2-column grid that needs to become 3-column.

- [ ] **Step 5: Verify in browser**

Run dev server, create a new client project, confirm Tax % field appears with default 21, submit and verify it saves.

- [ ] **Step 6: Commit**

```bash
git add src/components/admin/CreateProjectForm.tsx
git commit -m "feat: add tax percentage field to project creation form"
```

---

### Task 4: API routes — accept `taxPercentage`

**Files:**

- Modify: `src/app/api/projects/route.ts`

- [ ] **Step 1: Update POST handler**

In the POST handler (around line 113), extract `taxPercentage` from the request body alongside other fields:

```typescript
const {
  title,
  description,
  status,
  stage,
  startDate,
  deadline,
  subtotal,
  currency,
  type,
  organizationId,
  companyId,
  taxPercentage,
} = await request.json();
```

Then include it in the `createProject()` call (around line 170), alongside the other fields:

```typescript
taxPercentage: taxPercentage || "21",
```

- [ ] **Step 2: Update PATCH handler**

In the PATCH handler (around line 193), extract `taxPercentage` from the request body:

```typescript
const {
  id,
  title,
  description,
  status,
  stage,
  startDate,
  deadline,
  subtotal,
  currency,
  type,
  taxPercentage,
} = await request.json();
```

Include it in the update data object using the same conditional spread pattern used by other fields:

```typescript
...(taxPercentage !== undefined && { taxPercentage }),
```

- [ ] **Step 3: Check `createProject` query function**

In `src/lib/db/queries.ts`, find the `createProject` function and verify it passes through all fields to the insert. If it destructures specific fields, add `taxPercentage` to the destructuring. If it spreads the input object, no change needed.

- [ ] **Step 4: Verify build**

Run: `bun run build`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/app/api/projects/route.ts src/lib/db/queries.ts
git commit -m "feat: accept taxPercentage in project API routes"
```

---

### Task 5: Project edit form — add Tax % input

**Files:**

- Modify: `src/components/admin/ProjectsTable.tsx`

- [ ] **Step 1: Add edit state variables**

Find the edit state declarations (around lines 210-236) and add:

```typescript
const [editTaxPercentage, setEditTaxPercentage] = useState("");
const [originalTaxPercentage, setOriginalTaxPercentage] = useState("");
```

- [ ] **Step 2: Sync state when edit opens**

Find the `useEffect` that syncs edit form values when `selectedProject` changes (around lines 559-599). Add:

```typescript
setEditTaxPercentage(selectedProject?.taxPercentage ?? "21");
setOriginalTaxPercentage(selectedProject?.taxPercentage ?? "21");
```

- [ ] **Step 3: Add to change detection**

Find the `hasChanges` useMemo (around lines 602-634). Add to the comparison:

```typescript
editTaxPercentage.trim() !== originalTaxPercentage.trim() ||
```

And add `editTaxPercentage` and `originalTaxPercentage` to the dependency array.

- [ ] **Step 4: Include in update mutation**

Find the `handleUpdate` function (around lines 636-671). Add `taxPercentage` to the mutation payload:

```typescript
taxPercentage: projectType === "client" ? editTaxPercentage || "21" : null,
```

- [ ] **Step 5: Add Tax % input to the Drawer edit form**

Find the Subtotal/Currency section in the Drawer form content (around lines 819-849, inside the client-only block). Add a Tax % input alongside them. Adjust the grid to accommodate 3 fields:

```tsx
<div>
  <Label htmlFor="edit-tax">Tax %</Label>
  <Input
    id="edit-tax"
    type="number"
    step="1"
    min="0"
    max="100"
    placeholder="21"
    value={editTaxPercentage}
    onChange={(e) => setEditTaxPercentage(e.target.value)}
  />
</div>
```

- [ ] **Step 6: Add Tax % input to the Dialog edit form**

The Dialog version (around lines 1325-1529) mirrors the Drawer. Add the same Tax % input in the corresponding location within the Dialog's client-only subtotal/currency section.

- [ ] **Step 7: Verify in browser**

Open a project edit dialog, confirm Tax % shows with correct value, change it, save, reopen to verify persistence.

- [ ] **Step 8: Commit**

```bash
git add src/components/admin/ProjectsTable.tsx
git commit -m "feat: add tax percentage to project edit form"
```

---

### Task 6: Public project page — use per-project tax percentage

**Files:**

- Modify: `src/components/ProjectDetails.tsx`

- [ ] **Step 1: Read project's taxPercentage and pass to calculations**

Find the calculation block (around lines 167-174). Update to:

```typescript
const currency = project.currency || "EUR";
const projectTax = parseFloat(project.taxPercentage ?? "21") || 21;
const vat = calculateVAT(project.subtotal, currency, projectTax);
const total = calculateTotal(project.subtotal, currency, projectTax);
const paymentAmount = calculatePaymentAmount(
  project.subtotal,
  project.stage,
  currency,
  projectTax
);
```

- [ ] **Step 2: Update VAT display to show actual percentage**

Find the VAT row (around line 337). Replace:

```tsx
{VAT_PERCENTAGE}% BTW
```

with:

```tsx
{projectTax}% BTW
```

- [ ] **Step 3: Update tooltip text**

Find the tooltip content (around line 349). Update to dynamically show the rate:

```tsx
<TooltipContent className="max-w-68">
  <p>BTW rate of {projectTax}% as configured for this project.</p>
</TooltipContent>
```

- [ ] **Step 4: Clean up unused import**

Remove the `VAT_PERCENTAGE` import from `@/lib/constants` if it's no longer used in this file. Check if any other reference to `VAT_PERCENTAGE` remains in the file first.

- [ ] **Step 5: Verify in browser**

Visit a public project page, confirm VAT displays with the project's tax percentage, not the global constant.

- [ ] **Step 6: Commit**

```bash
git add src/components/ProjectDetails.tsx
git commit -m "feat: use per-project tax percentage on public project page"
```

---

### Task 7: Invoice creation — pre-fill line item from project

**Files:**

- Modify: `src/components/admin/CreateInvoiceForm.tsx`

- [ ] **Step 1: Add `taxPercentage` to the project filtering useEffect**

Find the useEffect that filters projects by organization (around lines 490-507). Add `taxPercentage` to the mapped project data:

```typescript
const filteredProjects =
  projectsData
    ?.filter((p) => p.project.companyId === organizationId)
    .map((p) => ({
      id: p.project.id,
      title: p.project.title,
      organizationId: p.project.companyId ?? organizationId,
      subtotal: p.project.subtotal,
      currency: p.project.currency,
      taxPercentage: p.project.taxPercentage,
    })) || [];
```

- [ ] **Step 2: Pre-fill line item when project is selected**

Find the project select `onValueChange` handler (around lines 812-814). Replace it with logic that pre-fills a line item:

```typescript
onValueChange={(value) => {
  const selectedId = value === "none" ? "" : value;
  setProjectId(selectedId);

  if (selectedId) {
    const selectedProject = projects.find((p) => p.id === selectedId);
    if (selectedProject) {
      const tax = isKOR ? "0" : (selectedProject.taxPercentage ?? "21");
      setLineItems([
        {
          description: selectedProject.title,
          quantity: "1",
          unitPrice: selectedProject.subtotal ?? "",
          taxPercentage: tax,
        },
      ]);
      if (selectedProject.currency) {
        setCurrency(selectedProject.currency);
      }
    }
  }
}}
```

- [ ] **Step 3: Update the projects state type**

Find where the `projects` state is defined (around line 192 or nearby). Check the type used for the project items and ensure `taxPercentage` is included. If the type is inline, add `taxPercentage: string | null` to it. If it references a separate interface, update that interface.

- [ ] **Step 4: Verify in browser**

Create a new invoice, select an organization, then select a project. Confirm:

- Line item is pre-filled with project title, subtotal, and tax %
- Currency switches to match project
- Line item is editable
- Additional line items can still be added
- Changing project re-fills the line items
- KOR checkbox still overrides tax to 0%

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/CreateInvoiceForm.tsx
git commit -m "feat: pre-fill invoice line item from selected project"
```

---

### Task 8: Final verification and cleanup

- [ ] **Step 1: Full build check**

Run: `bun run build`
Expected: No errors

- [ ] **Step 2: End-to-end walkthrough**

1. Create a new client project with Tax % set to 9%
2. Visit the public project page — confirm 9% BTW is shown with correct total
3. Create an invoice for that project — confirm line item pre-fills with 9% tax
4. Edit the project, change Tax % to 21%
5. Revisit public page — confirm 21% now shows
6. Create another invoice — confirm 21% pre-fills

- [ ] **Step 3: Commit any remaining changes**

```bash
git add -A
git commit -m "chore: final cleanup for project tax percentage feature"
```
