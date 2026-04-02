import {
  pgTable,
  text,
  timestamp,
  uuid,
  boolean,
  decimal,
  integer,
  primaryKey,
} from "drizzle-orm/pg-core";

export const COMPANY_TYPES = ["client", "supplier", "both"] as const;
export type CompanyType = (typeof COMPANY_TYPES)[number];

export const CONTACT_TYPES = ["client", "supplier", "both"] as const;
export type ContactType = (typeof CONTACT_TYPES)[number];

export const companies = pgTable("companies", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  imageStoragePath: text("image_storage_path"), // Path in Supabase Storage (logo)
  imageSizeBytes: integer("image_size_bytes"), // File size in bytes
  address: text("address"),
  kvkNumber: text("kvk_number"),
  btwNumber: text("btw_number"),
  email: text("email"),
  telephone: text("telephone"),
  type: text("type").notNull().default("client"), // client | supplier | both
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const contacts = pgTable("contacts", {
  id: uuid("id").primaryKey().defaultRandom(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email"),
  phone: text("phone"),
  photo: text("photo"), // Path in Supabase Storage
  companyId: uuid("company_id").references(() => companies.id),
  type: text("type").notNull().default("client"), // client | supplier | both
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name"),
  phone: text("phone"),
  note: text("note"),
  imageStoragePath: text("image_storage_path"), // Path in Supabase Storage (e.g., "users/user-123.jpg")
  imageSizeBytes: integer("image_size_bytes"), // File size in bytes
  companyId: uuid("company_id").references(() => companies.id),
  contactId: uuid("contact_id")
    .references(() => contacts.id, { onDelete: "set null" })
    .unique(), // One-to-one: user = portal login, optionally linked to a contact
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").notNull().default("active"), // active, completed, etc.
  stage: text("stage").notNull().default("kick_off"), // kick_off, pay_first, deliver, revise, pay_final, completed
  startDate: timestamp("start_date"),
  deadline: timestamp("deadline"),
  subtotal: text("subtotal"), // Nullable for EXO Labs projects
  currency: text("currency").notNull().default("EUR"), // USD, EUR
  type: text("type").notNull().default("client"), // client, labs
  companyId: uuid("company_id")
    .references(() => companies.id)
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const deliverables = pgTable("deliverables", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .references(() => projects.id)
    .notNull(),
  name: text("name").notNull(),
  fileUrl: text("file_url"),
  fileType: text("file_type"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const clientAssets = pgTable("client_assets", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .references(() => projects.id)
    .notNull(),
  name: text("name").notNull(),
  fileUrl: text("file_url"),
  fileType: text("file_type"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const contracts = pgTable("contracts", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id")
    .references(() => companies.id)
    .notNull(),
  contactId: uuid("contact_id").references(() => contacts.id, {
    onDelete: "set null",
  }),
  projectId: uuid("project_id").references(() => projects.id), // Deprecated: kept for backward compatibility, use contractProjects junction table
  name: text("name").notNull(),
  type: text("type").notNull(), // 'agreement', 'nda', 'contract', etc.
  fileStoragePath: text("file_storage_path"), // Path in Supabase Storage (e.g., "contracts/contract-123.pdf")
  fileName: text("file_name"), // Original filename
  fileSizeBytes: integer("file_size_bytes"), // File size in bytes
  requiresPortalSignature: boolean("requires_portal_signature")
    .default(true)
    .notNull(), // If false, contract is already signed or doesn't need portal signing
  signed: boolean("signed").default(false).notNull(),
  signedAt: timestamp("signed_at"),
  signature: text("signature"), // Base64 encoded signature image
  signedBy: uuid("signed_by").references(() => users.id), // User who signed
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const contractProjects = pgTable("contract_projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  contractId: uuid("contract_id")
    .references(() => contracts.id, { onDelete: "cascade" })
    .notNull(),
  projectId: uuid("project_id")
    .references(() => projects.id, { onDelete: "cascade" })
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const hourRegistrations = pgTable("hour_registrations", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .references(() => users.id)
    .notNull(),
  projectId: uuid("project_id").references(() => projects.id),
  contactId: uuid("contact_id").references(() => contacts.id, {
    onDelete: "set null",
  }),
  description: text("description").notNull(),
  hours: decimal("hours", { precision: 10, scale: 2 }).notNull(), // Stored as decimal for precision
  category: text("category").notNull().default("client"), // client, administration, brainstorming, research, labs, client_acquisition, content_creation
  date: timestamp("date").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Many-to-many relationship between contacts and companies
export const contactCompanies = pgTable(
  "contact_companies",
  {
    contactId: uuid("contact_id")
      .references(() => contacts.id, { onDelete: "cascade" })
      .notNull(),
    companyId: uuid("company_id")
      .references(() => companies.id, { onDelete: "cascade" })
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.contactId, table.companyId] }),
  })
);

// Many-to-many relationship between users and companies
export const userCompanies = pgTable(
  "user_companies",
  {
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    companyId: uuid("company_id")
      .references(() => companies.id, { onDelete: "cascade" })
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.companyId] }),
  })
);

export const expenses = pgTable("expenses", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .references(() => users.id)
    .notNull(),
  description: text("description").notNull(),
  amount: text("amount").notNull(), // Stored as text to preserve formatting (original amount)
  currency: text("currency").notNull().default("EUR"), // USD, EUR
  date: timestamp("date").defaultNow().notNull(),
  category: text("category"), // e.g., "office", "software", "travel", "equipment", etc.
  vendor: text("vendor"), // Where the expense was made (store, company, etc.) — kept for backward compatibility
  companyId: uuid("company_id").references(() => companies.id, {
    onDelete: "set null",
  }),
  contactId: uuid("contact_id").references(() => contacts.id, {
    onDelete: "set null",
  }),
  invoiceStoragePath: text("invoice_storage_path"), // Path in Supabase Storage (e.g., "expenses/expense-123.pdf")
  invoiceFileName: text("invoice_file_name"), // Original filename
  invoiceSizeBytes: integer("invoice_size_bytes"), // File size in bytes
  // Historical exchange rate: for non-EUR expenses, store EUR equivalent at transaction date
  eurEquivalent: decimal("eur_equivalent", { precision: 12, scale: 2 }),
  exchangeRate: decimal("exchange_rate", { precision: 10, scale: 6 }),
  exchangeRateDate: timestamp("exchange_rate_date"),
  btwStatus: text("btw_status").notNull().default("te_vorderen"), // "te_vorderen", "verrekend", "n_v_t"
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const invoices = pgTable("invoices", {
  id: uuid("id").primaryKey().defaultRandom(),
  invoiceNumber: text("invoice_number").notNull().unique(),
  projectId: uuid("project_id").references(() => projects.id, {
    onDelete: "set null",
  }),
  companyId: uuid("company_id")
    .references(() => companies.id)
    .notNull(),
  contactId: uuid("contact_id").references(() => contacts.id, {
    onDelete: "set null",
  }),
  expenseId: uuid("expense_id")
    .references(() => expenses.id, {
      onDelete: "set null",
    })
    .unique(),
  amount: text("amount").notNull(), // Stored as text to preserve formatting (total amount)
  currency: text("currency").notNull().default("EUR"), // USD, EUR
  status: text("status").notNull().default("draft"), // draft, sent, paid, overdue, cancelled
  type: text("type").notNull().default("manual"), // auto, manual
  transactionType: text("transaction_type").notNull().default("debit"), // debit, credit
  vatIncluded: boolean("vat_included"), // Deprecated: whether 21% VAT is included in the total (kept for backward compatibility)
  isKOR: boolean("is_kor").notNull().default(false), // Kleine ondernemersregeling - if true, no tax is charged
  description: text("description"), // For manual invoices (deprecated, use line items instead)
  invoiceDate: timestamp("invoice_date").notNull(), // Invoice date (required)
  dueDate: timestamp("due_date"),
  paidAt: timestamp("paid_at"),
  pdfStoragePath: text("pdf_storage_path"), // Path in Supabase Storage (e.g., "invoices/invoice-123.pdf")
  pdfFileName: text("pdf_file_name"), // Original filename
  pdfSizeBytes: integer("pdf_size_bytes"), // File size in bytes
  sentAt: timestamp("sent_at"), // When invoice was sent by email
  sentToEmail: text("sent_to_email"), // Email address it was sent to
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const OFFER_STATUSES = ["draft", "sent", "signed", "discarded"] as const;
export type OfferStatus = (typeof OFFER_STATUSES)[number];

export const offers = pgTable("offers", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").references(() => projects.id, {
    onDelete: "set null",
  }),
  companyId: uuid("company_id").references(() => companies.id, {
    onDelete: "set null",
  }),
  contactId: uuid("contact_id").references(() => contacts.id, {
    onDelete: "set null",
  }),
  note: text("note"),
  content: text("content"), // Markdown content (for AI-generated offers, before PDF)
  fileStoragePath: text("file_storage_path"), // Path in Supabase Storage
  fileName: text("file_name"), // Original filename
  fileSizeBytes: integer("file_size_bytes"), // File size in bytes
  status: text("status").notNull().default("draft"), // draft, sent, signed, discarded
  sentAt: timestamp("sent_at"), // When offer was sent by email
  sentToEmail: text("sent_to_email"), // Email address it was sent to
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const assets = pgTable("assets", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description"),
  purchaseDate: timestamp("purchase_date").notNull(),
  purchasePrice: decimal("purchase_price", {
    precision: 12,
    scale: 2,
  }).notNull(),
  residualValue: decimal("residual_value", { precision: 12, scale: 2 })
    .notNull()
    .default("0"),
  usefulLifeYears: integer("useful_life_years").notNull().default(5),
  category: text("category"), // e.g. "equipment", "software", "furniture"
  linkedExpenseId: uuid("linked_expense_id")
    .references(() => expenses.id, { onDelete: "set null" })
    .unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const invoiceLineItems = pgTable("invoice_line_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  invoiceId: uuid("invoice_id")
    .references(() => invoices.id, { onDelete: "cascade" })
    .notNull(),
  description: text("description").notNull(),
  quantity: decimal("quantity", { precision: 10, scale: 2 })
    .notNull()
    .default("1"), // Quantity/amount
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(), // Price per unit
  taxPercentage: decimal("tax_percentage", { precision: 5, scale: 2 })
    .notNull()
    .default("0"), // Tax percentage (0-100)
  order: integer("order").notNull().default(0), // Order of items in the invoice
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
