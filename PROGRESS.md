# EXO Portal – Feature Implementation Progress

## Phase 1 – Data Model Restructure

### 1.1 – Introduce `companies` table (replaces `organizations`) ✅

- [x] Rename/migrate `organizations` → `companies`
- [x] Fields: id, name, kvk, btw, address, email, phone, logo, type (enum: `client` | `supplier` | `both`), createdAt
- [x] Update all foreign keys that referenced `organizations` to reference `companies`
- [x] Update all API routes, queries, and UI components accordingly
- [x] Keep logo upload via Supabase Storage (same as current org image)

**Implementation notes:**

- Migration `0043_organizations_to_companies.sql` renames table, adds `type` column, renames `organization_id` → `company_id` in users, projects, contracts, invoices, and renames `user_organizations` → `user_companies`. RLS policies and helper functions updated accordingly.
- API routes at `/api/organizations` retained for backward compatibility; they now use companies under the hood.
- Frontend forms still send `organizationId`; API accepts both `organizationId` and `companyId`.
- Storage bucket remains "organizations" for existing logo paths; `uploadCompanyImage`/`deleteCompanyImage`/`getCompanyImageUrl` use same bucket.

### 1.2 – Introduce `contacts` table (replaces the client-side user concept) ✅

- [x] New table: id, firstName, lastName, email, phone, photo, companyId (optional FK → companies), type (enum: `client` | `supplier` | `both`), createdAt
- [x] A contact represents any person you have a business relationship with — client, supplier, or both
- [x] Contacts do NOT need a login; they are just records

**Implementation notes:**

- Migration `0044_add_contacts_table.sql` creates contacts table with RLS (staff only).
- API at `/api/contacts` with GET, POST, PATCH, DELETE. Dashboard at `/dashboard/contacts` with ContactsTable and CreateContactForm.

### 1.3 – Decouple `users` from contacts ✅

- [x] Add optional FK `contactId` on `users` table (one-to-one)
- [x] A user = someone with portal login access
- [x] When granting portal access to a contact, create a `user` record linked to that contact
- [x] Update auth flow: on first login, match email to existing contact if possible and link automatically
- [x] Update `UsersTable` and `CreateUserForm` to reflect this — you now "grant access" to a contact rather than creating a standalone user

**Implementation notes:**

- Migration `0045_add_user_contact_id.sql` adds `contact_id` column to users.
- CreateUserForm: contact selector pre-fills email, name, phone, and company; sends `contactId` when creating user.
- UsersTable: Contact column shows linked contact name.
- Auth callback: `ensureUserExists` links user to contact by email on first login if contact exists.
- `getAllUsersPaginated` and `getAllUsersCount` include contact join and search by contact name/email.

### 1.4 – Update relations throughout the app ✅

- [x] `projects` → link to `companies` (not organizations)
- [x] `expenses` → replace vendor string with optional FK to `companies` or `contacts`
- [x] `invoices` → link to `companies` or `contacts`
- [x] `hourRegistrations` → link to `contacts` (optional) and `projects` (optional, filtered by contact)
- [x] `offers` → link to `companies` or `contacts`
- [x] `contracts` → link to `companies` or `contacts`

**Implementation notes:**

- Migration `0046_phase_relations_company_contact.sql` adds: expenses (company_id, contact_id), invoices (contact_id), hour_registrations (contact_id), offers (company_id, contact_id), contracts (contact_id).
- Schema, queries, and API routes updated for all entities. Vendor text on expenses kept for backward compatibility.

---

## Phase 2 – Hour Registration Improvements

### 2.1 – Contact-first selection flow ✅

- [x] In the hour registration form, show **Contact** as the first selection (optional)
- [x] If a contact is selected, show **Project** filtered to only projects linked to that contact's company
- [x] If no contact is selected, Project dropdown shows all active projects
- [x] It must be possible to register hours for just a contact (no project), just a project, or both

### 2.2 – Hide project selection for non-project categories ✅

- [x] Categories that should NOT show a project/contact selector: `content_creation`, `administration`, `brainstorming`, `research`
- [x] Categories that SHOULD show contact + project: `client`, `labs`, `client_acquisition`, `traveling`

---

## Phase 3 – Expenses: AI-powered invoice scanning

### 3.1 – Upload incoming invoice and auto-extract data ✅

- [x] On the CreateExpenseForm, add an "Upload invoice" step first (optional; user can skip)
- [x] After upload, send the file to the OpenAI API (`gpt-4o-mini`) using Responses API with PDF input to extract: vendor name, amount, currency, date, BTW number if present, description
- [x] Pre-fill the form fields with extracted data
- [x] User can review and correct before saving
- [x] If a company with the same name or BTW number already exists in `companies`, suggest linking to it in the company selector
- [x] Company selector shows suggested companies first, then all companies

**Implementation notes:**

- API route `/api/expenses/extract-invoice` accepts PDF via FormData, uses OpenAI Responses API with `input_file` (base64), returns extracted JSON + `suggestedCompanies`.
- `getCompaniesByNameOrBtw(vendorName, btwNumber)` in queries.ts finds matching companies.
- CreateExpenseForm: two-step flow (upload/skip) for create mode; extract on file select; company selector with suggested + all companies.
- Add `OPENAI_API_KEY` to `.env.local` for extraction to work.

---

## Phase 4 – Offers: AI-powered quote generation

### 4.1 – AI offer generation based on consistent template ✅

- [x] Add a "Generate with AI" flow in CreateOfferForm
- [x] Inputs: description, contact/company selector, language (NL/EN), prijssuggestie
- [x] AI generates offer following exact markdown structure and EXO tone
- [x] User can edit in rich text / markdown editor before PDF generation
- [x] Output rendered as PDF using pdfkit
- [x] Save as draft offer, linkable to a project

**Implementation notes:**

- Migration `0048_offers_content.sql` adds `content` column to offers table.
- API route `/api/offers/generate` uses OpenAI gpt-4.1-mini to generate offer markdown from description, contact/company, language, and prijssuggestie.
- API route `/api/offers/generate-pdf` converts markdown to PDF via pdfkit and uploads to Supabase Storage.
- CreateOfferForm: toggle between "Upload file" and "Generate with AI". AI flow: fill inputs → Generate → edit markdown → Save as draft.

---

## Phase 5 – Projects: AI-generated project description ✅

### 5.1 – Generate project description with AI

- [x] Add "Genereer beschrijving" button on project detail page
- [x] Modal with two options: Obv offerte or Custom input
- [x] Language selector: Nederlands or English
- [x] Editable textarea before saving
- [x] Updates project's description field

**Implementation notes:**

- GenerateProjectDescriptionModal in ProjectsTable edit drawer. API `/api/projects/[id]/generate-description` uses OpenAI to summarize offer content or custom input.

---

## Phase 6 – Email: Send invoices and offers from the portal ✅

### 6.1 – Email invoice directly from portal

- [x] "Send by email" button on invoice detail/table
- [x] Modal with pre-filled editable template
- [x] Attach invoice PDF, send via Resend
- [x] Log sent status + timestamp on invoice record

### 6.2 – Email offer directly from portal

- [x] Same as 6.1 but for offers
- [x] Log sent status on offer record

**Implementation notes:**

- SendEmailModal used by InvoicesTable and OffersTable. API routes `/api/invoices/[id]/send` and `/api/offers/[id]/send` use Resend, attach PDF, update sentAt and sentToEmail.

---

## Phase 7 – Financials: Assets & Depreciation ✅

### 7.1 – Introduce `assets` table

- [x] Fields: id, name, description, purchaseDate, purchasePrice, residualValue, usefulLifeYears, category, linkedExpenseId, createdAt

### 7.2 – Depreciation schedule

- [x] Auto-calculate yearly and monthly depreciation per asset
- [x] Show depreciation schedule table per asset
- [x] Show current book value
- [x] Total annual depreciation in financials overview

### 7.3 – Mark expense as asset

- [x] "Mark as asset" action on expense record
- [x] Creates asset linked to expense
- [x] Exclude from direct cost calculations (use depreciation instead)

**Implementation notes:**

- API: GET/POST /api/assets, PATCH/DELETE /api/assets/[id]. MarkAsAssetModal creates asset from expense. FinancialsOverview: Assets section with depreciation schedule. getFinancialsStats excludes asset-linked expenses from direct cost, adds depreciation.

---

## Phase 8 – BTW / VAT Quarterly Overview ✅

### 8.1 – BTW aangifte overzicht

- [x] "BTW Aangifte" tab in Financials
- [x] Per quarter: BTW collected, BTW paid, net position
- [x] Notice for periods before Q2 2026 (KOR ended 1 April 2026)
- [x] Export as PDF

**Implementation notes:**

- BTW Aangifte tab in FinancialsOverview with year selector, quarterly table, KOR notice, PDF export.

---

## Phase 9 – General / UX ✅

### 9.1 – BTW aangifte deadline reminders

- [x] Banner/notification when BTW deadline approaching (within 14 days)
- [x] Deadlines: 1 mei, 1 augustus, 1 november, 31 januari
- [x] Dismissable per deadline

### 9.2 – Historical exchange rate on expenses

- [x] Fetch and store exchange rate on transaction date for foreign currency expenses
- [x] Use api.exchangerate-api.com or similar
- [x] Store original amount + currency and EUR equivalent
- [x] Use EUR equivalent in all financial calculations

### 9.3 – Profit & Loss export

- [x] "Export jaar P&L" button in Financials
- [x] PDF with: revenue, cost of goods/services, gross profit, expenses by category, depreciation, net profit, BTW summary
- [x] Per tax year (2025 / 2026 selector)

**Implementation notes:**

- 9.1: BTW deadline banner on Financials page, localStorage for dismiss state. 9.2: Migration 0051 adds eurEquivalent, exchangeRate, exchangeRateDate to expenses. CreateExpenseForm fetches historical rate. 9.3: Export jaar P&L PDF in FinancialsOverview.
