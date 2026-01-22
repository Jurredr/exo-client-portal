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

export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  image: text("image"),
  address: text("address"),
  kvkNumber: text("kvk_number"),
  btwNumber: text("btw_number"),
  email: text("email"),
  telephone: text("telephone"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name"),
  phone: text("phone"),
  note: text("note"),
  image: text("image"),
  organizationId: uuid("organization_id").references(() => organizations.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").notNull().default("active"), // active, completed, etc.
  stage: text("stage").notNull().default("kick_off"), // kick_off, pay_first, deliver, revise, pay_final, completed
  startDate: timestamp("start_date"),
  deadline: timestamp("deadline"),
  subtotal: text("subtotal"), // Nullable for EXO Labs projects
  currency: text("currency").notNull().default("EUR"), // USD, EUR
  type: text("type").notNull().default("client"), // client, labs
  organizationId: uuid("organization_id")
    .references(() => organizations.id)
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

export const legalDocuments = pgTable("legal_documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .references(() => organizations.id)
    .notNull(),
  projectId: uuid("project_id").references(() => projects.id), // Deprecated: kept for backward compatibility, use contractProjects junction table
  name: text("name").notNull(),
  type: text("type").notNull(), // 'agreement', 'nda', 'contract', etc.
  fileStoragePath: text("file_storage_path"), // Path in Supabase Storage (e.g., "contracts/contract-123.pdf")
  fileName: text("file_name"), // Original filename
  fileType: text("file_type"), // MIME type
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
    .references(() => legalDocuments.id, { onDelete: "cascade" })
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
  description: text("description").notNull(),
  hours: decimal("hours", { precision: 10, scale: 2 }).notNull(), // Stored as decimal for precision
  category: text("category").notNull().default("client"), // client, administration, brainstorming, research, labs, client_acquisition, content_creation
  date: timestamp("date").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Many-to-many relationship between users and organizations
export const userOrganizations = pgTable(
  "user_organizations",
  {
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    organizationId: uuid("organization_id")
      .references(() => organizations.id, { onDelete: "cascade" })
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.organizationId] }),
  })
);

export const invoices = pgTable("invoices", {
  id: uuid("id").primaryKey().defaultRandom(),
  invoiceNumber: text("invoice_number").notNull().unique(),
  projectId: uuid("project_id").references(() => projects.id, {
    onDelete: "set null",
  }),
  organizationId: uuid("organization_id")
    .references(() => organizations.id)
    .notNull(),
  amount: text("amount").notNull(), // Stored as text to preserve formatting (total amount)
  currency: text("currency").notNull().default("EUR"), // USD, EUR
  status: text("status").notNull().default("draft"), // draft, sent, paid, overdue, cancelled
  type: text("type").notNull().default("manual"), // auto, manual
  transactionType: text("transaction_type").notNull().default("debit"), // debit, credit
  vatIncluded: boolean("vat_included"), // Deprecated: whether 21% VAT is included in the total (kept for backward compatibility)
  isKOR: boolean("is_kor").notNull().default(false), // Kleine ondernemersregeling - if true, no tax is charged
  description: text("description"), // For manual invoices (deprecated, use line items instead)
  invoiceDate: timestamp("invoice_date"), // Manual invoice date (defaults to createdAt if not set)
  dueDate: timestamp("due_date"),
  paidAt: timestamp("paid_at"),
  pdfStoragePath: text("pdf_storage_path"), // Path in Supabase Storage (e.g., "invoices/invoice-123.pdf")
  pdfFileName: text("pdf_file_name"), // Original filename
  pdfFileType: text("pdf_file_type"), // MIME type
  pdfSizeBytes: integer("pdf_size_bytes"), // File size in bytes
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
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

export const expenses = pgTable("expenses", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .references(() => users.id)
    .notNull(),
  description: text("description").notNull(),
  amount: text("amount").notNull(), // Stored as text to preserve formatting
  currency: text("currency").notNull().default("EUR"), // USD, EUR
  date: timestamp("date").defaultNow().notNull(),
  category: text("category"), // e.g., "office", "software", "travel", "equipment", etc.
  vendor: text("vendor"), // Where the expense was made (store, company, etc.)
  invoiceStoragePath: text("invoice_storage_path"), // Path in Supabase Storage (e.g., "expenses/expense-123.pdf")
  invoiceFileName: text("invoice_file_name"), // Original filename
  invoiceFileType: text("invoice_file_type"), // MIME type
  invoiceSizeBytes: integer("invoice_size_bytes"), // File size in bytes
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
