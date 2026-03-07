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

### 2.1 – Contact-first selection flow

- [ ] In the hour registration form, show **Contact** as the first selection (optional)
- [ ] If a contact is selected, show **Project** filtered to only projects linked to that contact's company
- [ ] If no contact is selected, Project dropdown shows all active projects
- [ ] It must be possible to register hours for just a contact (no project), just a project, or both

### 2.2 – Hide project selection for non-project categories

- [ ] Categories that should NOT show a project/contact selector: `content_creation`, `administration`, `brainstorming`, `research`
- [ ] Categories that SHOULD show contact + project: `client`, `labs`, `client_acquisition`, `traveling`

---

## Phase 3 – Expenses: AI-powered invoice scanning

### 3.1 – Upload incoming invoice and auto-extract data

- [ ] On the CreateExpenseForm, add an "Upload invoice" step first
- [ ] After upload, send the file to the OpenAI API (`gpt-4.1-mini`) using vision with a prompt to extract: vendor name, amount, currency, date, BTW number if present, description
- [ ] Pre-fill the form fields with extracted data
- [ ] User can review and correct before saving
- [ ] If a company with the same name or BTW number already exists in `companies`, suggest linking to it automatically
- [ ] If not, offer to create a new company record on the spot

---

## Phase 4 – Offers: AI-powered quote generation

### 4.1 – AI offer generation based on consistent template

- [ ] Add a "Generate with AI" flow in CreateOfferForm
- [ ] Inputs: description, contact/company selector, language (NL/EN), prijssuggestie
- [ ] AI generates offer following exact markdown structure and EXO tone
- [ ] User can edit in rich text / markdown editor before PDF generation
- [ ] Output rendered as PDF using pdfkit
- [ ] Save as draft offer, linkable to a project

---

## Phase 5 – Projects: AI-generated project description

### 5.1 – Generate project description with AI

- [ ] Add "Genereer beschrijving" button on project detail page
- [ ] Modal with two options: Obv offerte or Custom input
- [ ] Language selector: Nederlands or English
- [ ] Editable textarea before saving
- [ ] Updates project's description field

---

## Phase 6 – Email: Send invoices and offers from the portal

### 6.1 – Email invoice directly from portal

- [ ] "Send by email" button on invoice detail/table
- [ ] Modal with pre-filled editable template
- [ ] Attach invoice PDF, send via Resend
- [ ] Log sent status + timestamp on invoice record

### 6.2 – Email offer directly from portal

- [ ] Same as 6.1 but for offers
- [ ] Log sent status on offer record

---

## Phase 7 – Financials: Assets & Depreciation

### 7.1 – Introduce `assets` table

- [ ] Fields: id, name, description, purchaseDate, purchasePrice, residualValue, usefulLifeYears, category, linkedExpenseId, createdAt

### 7.2 – Depreciation schedule

- [ ] Auto-calculate yearly and monthly depreciation per asset
- [ ] Show depreciation schedule table per asset
- [ ] Show current book value
- [ ] Total annual depreciation in financials overview

### 7.3 – Mark expense as asset

- [ ] "Mark as asset" action on expense record
- [ ] Creates asset linked to expense
- [ ] Exclude from direct cost calculations (use depreciation instead)

---

## Phase 8 – BTW / VAT Quarterly Overview

### 8.1 – BTW aangifte overzicht

- [ ] "BTW Aangifte" tab in Financials
- [ ] Per quarter: BTW collected, BTW paid, net position
- [ ] Notice for periods before Q2 2026 (KOR ended 1 April 2026)
- [ ] Export as PDF

---

## Phase 9 – General / UX

### 9.1 – BTW aangifte deadline reminders

- [ ] Banner/notification when BTW deadline approaching (within 14 days)
- [ ] Deadlines: 1 mei, 1 augustus, 1 november, 31 januari
- [ ] Dismissable per deadline

### 9.2 – Historical exchange rate on expenses

- [ ] Fetch and store exchange rate on transaction date for foreign currency expenses
- [ ] Use api.exchangerate-api.com or similar
- [ ] Store original amount + currency and EUR equivalent
- [ ] Use EUR equivalent in all financial calculations

### 9.3 – Profit & Loss export

- [ ] "Export jaar P&L" button in Financials
- [ ] PDF with: revenue, cost of goods/services, gross profit, expenses by category, depreciation, net profit, BTW summary
- [ ] Per tax year (2025 / 2026 selector)
