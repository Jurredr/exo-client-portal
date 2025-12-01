import {
  pgTable,
  text,
  timestamp,
  uuid,
  boolean,
  decimal,
  primaryKey,
} from "drizzle-orm/pg-core";

export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  image: text("image"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name"),
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
  projectId: uuid("project_id")
    .references(() => projects.id)
    .notNull(),
  name: text("name").notNull(),
  type: text("type").notNull(), // 'agreement', 'nda', 'contract', etc.
  fileUrl: text("file_url"),
  signed: boolean("signed").default(false).notNull(),
  signedAt: timestamp("signed_at"),
  signature: text("signature"), // Base64 encoded signature image
  signedBy: uuid("signed_by").references(() => users.id), // User who signed
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
  category: text("category").notNull().default("client"), // client, administration, brainstorming, research, labs
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
  amount: text("amount").notNull(), // Stored as text to preserve formatting
  currency: text("currency").notNull().default("EUR"), // USD, EUR
  status: text("status").notNull().default("draft"), // draft, sent, paid, overdue, cancelled
  type: text("type").notNull().default("manual"), // auto, manual
  description: text("description"), // For manual invoices
  dueDate: timestamp("due_date"),
  paidAt: timestamp("paid_at"),
  pdfUrl: text("pdf_url"), // URL to uploaded invoice PDF file
  pdfFileName: text("pdf_file_name"), // Original filename
  pdfFileType: text("pdf_file_type"), // MIME type
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
  invoiceUrl: text("invoice_url"), // URL to uploaded invoice file
  invoiceFileName: text("invoice_file_name"), // Original filename
  invoiceFileType: text("invoice_file_type"), // MIME type
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
