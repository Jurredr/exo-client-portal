import { pgTable, text, timestamp, uuid, boolean, integer, decimal } from "drizzle-orm/pg-core";

export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name"),
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
  subtotal: text("subtotal").notNull(),
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
  type: text("type").notNull(), // 'agreement', 'nda', 'invoice', etc.
  fileUrl: text("file_url"),
  signed: boolean("signed").default(false).notNull(),
  signedAt: timestamp("signed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const hourRegistrations = pgTable("hour_registrations", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .references(() => users.id)
    .notNull(),
  projectId: uuid("project_id")
    .references(() => projects.id),
  description: text("description").notNull(),
  hours: decimal("hours", { precision: 10, scale: 2 }).notNull(), // Stored as decimal for precision
  date: timestamp("date").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
