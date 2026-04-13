import { db } from "@/db";
import {
  projects,
  users,
  companies,
  contacts,
  contactCompanies,
  hourRegistrations,
  userCompanies,
  invoices,
  invoiceLineItems,
  contracts,
  contractProjects,
  expenses,
  offers,
  assets,
} from "@/db/schema";
import {
  eq,
  desc,
  sql,
  inArray,
  gte,
  lte,
  and,
  like,
  or,
  isNull,
  isNotNull,
} from "drizzle-orm";
import {
  ADMIN_EMAIL_DOMAIN,
  EXO_ORGANIZATION_NAME,
  VAT_PERCENTAGE,
} from "@/lib/constants";
import { KOR_END_DATE, KOR_START_DATE } from "@/lib/constants/exo-company";
import {
  calculateDutchIncomeTax,
  isRecurringExpenseCategory,
} from "@/lib/constants/dutch-tax";
import {
  getRevenueExcludingVAT,
  calculateVATFromLineItems,
} from "@/lib/utils/currency";
import { slugify, generateSlugSuffix } from "@/lib/utils/slug";

export function isAdmin(email: string): boolean {
  return email.endsWith(ADMIN_EMAIL_DOMAIN);
}

export async function isUserInEXOCompany(userEmail: string): Promise<boolean> {
  const user = await getUserByEmail(userEmail);
  if (!user) {
    return false;
  }

  const exoCompany = await getOrCreateEXOCompany();

  // Check primary company (backward compatibility)
  if (user.companyId === exoCompany.id) {
    return true;
  }

  // Check junction table
  const userCompany = await db
    .select()
    .from(userCompanies)
    .where(
      sql`${userCompanies.userId} = ${user.id} AND ${userCompanies.companyId} = ${exoCompany.id}`
    )
    .limit(1);

  return userCompany.length > 0;
}

export async function getOrCreateEXOCompany() {
  // Try to find EXO company
  const existing = await db
    .select()
    .from(companies)
    .where(eq(companies.name, EXO_ORGANIZATION_NAME))
    .limit(1);

  if (existing[0]) {
    return existing[0];
  }

  // Create EXO company if it doesn't exist
  const [newCompany] = await db
    .insert(companies)
    .values({
      name: EXO_ORGANIZATION_NAME,
    })
    .returning();

  return newCompany;
}

export async function ensureUserExists(
  email: string,
  name?: string | null,
  imageStoragePath?: string | null, // Path in Supabase Storage
  imageSizeBytes?: number | null
): Promise<typeof users.$inferSelect> {
  // Check if user exists
  const existing = await getUserByEmail(email);
  if (existing) {
    const updates: Record<string, unknown> = { updatedAt: new Date() };

    // Update image if provided and different
    if (imageStoragePath && existing.imageStoragePath !== imageStoragePath) {
      updates.imageStoragePath = imageStoragePath;
      updates.imageSizeBytes = imageSizeBytes || null;
    }

    // On first login: if user has no contactId, ensure they get one (link or create)
    if (!existing.contactId) {
      let contact = await getContactByEmail(email);
      if (!contact) {
        const nameParts = (name || email || "").trim().split(/\s+/);
        const firstName = nameParts[0] || email.split("@")[0] || "User";
        const lastName = nameParts.slice(1).join(" ") || "";
        contact = await createContact({
          firstName,
          lastName: lastName || firstName,
          email,
          companyId: existing.companyId,
          type: "client",
        });
      }
      updates.contactId = contact.id;
    }

    if (Object.keys(updates).length > 1) {
      const [updated] = await db
        .update(users)
        .set(updates as Partial<typeof users.$inferInsert>)
        .where(eq(users.id, existing.id))
        .returning();
      return updated;
    }
    return existing;
  }

  // Determine company
  let companyId: string | null = null;
  if (isAdmin(email)) {
    const exoCompany = await getOrCreateEXOCompany();
    companyId = exoCompany.id;
  }

  // Check for matching contact, or create one so every user has a contact
  let contact = await getContactByEmail(email);
  if (!contact) {
    const nameParts = (name || email || "").trim().split(/\s+/);
    const firstName = nameParts[0] || email.split("@")[0] || "User";
    const lastName = nameParts.slice(1).join(" ") || "";
    contact = await createContact({
      firstName,
      lastName: lastName || firstName,
      email,
      companyId: companyId || null,
      type: "client",
    });
  }
  const contactId = contact.id;
  if (!companyId && contact.companyId) {
    companyId = contact.companyId;
  }

  // Create user
  const [newUser] = await db
    .insert(users)
    .values({
      email,
      name: name || null,
      imageStoragePath: imageStoragePath || null,
      imageSizeBytes: imageSizeBytes || null,
      companyId,
      contactId,
    })
    .returning();

  return newUser;
}

export async function getProjectById(projectId: string) {
  const project = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  return project[0] || null;
}

export async function getProjectBySlug(slug: string) {
  const project = await db
    .select()
    .from(projects)
    .where(eq(projects.slug, slug))
    .limit(1);

  return project[0] || null;
}

export async function getUserByEmail(email: string) {
  const user = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  return user[0] || null;
}

export async function getUserById(userId: string) {
  const user = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return user[0] || null;
}

export async function getUserByContactId(contactId: string) {
  const user = await db
    .select()
    .from(users)
    .where(eq(users.contactId, contactId))
    .limit(1);

  return user[0] || null;
}

export async function getProjectsForUser(userEmail: string) {
  const user = await getUserByEmail(userEmail);
  if (!user) return [];

  const companyIds: string[] = [];
  if (user.companyId) companyIds.push(user.companyId);

  const userCompaniesList = await db
    .select({ companyId: userCompanies.companyId })
    .from(userCompanies)
    .where(eq(userCompanies.userId, user.id));
  userCompaniesList.forEach((uc) => {
    if (uc.companyId && !companyIds.includes(uc.companyId)) {
      companyIds.push(uc.companyId);
    }
  });

  if (companyIds.length === 0) return [];

  return db
    .select({
      id: projects.id,
      slug: projects.slug,
      title: projects.title,
      companyId: projects.companyId,
      companyName: companies.name,
    })
    .from(projects)
    .innerJoin(companies, eq(projects.companyId, companies.id))
    .where(
      and(eq(projects.type, "client"), inArray(projects.companyId, companyIds))
    )
    .orderBy(desc(projects.createdAt));
}

export async function canUserAccessProject(
  userEmail: string,
  projectId: string
): Promise<boolean> {
  // Admins can access any project
  if (isAdmin(userEmail)) {
    return true;
  }

  // Get the project
  const project = await getProjectById(projectId);
  if (!project || !project.companyId) {
    return false;
  }

  // Get the user
  const user = await getUserByEmail(userEmail);
  if (!user) {
    return false;
  }

  // Check primary company (backward compatibility)
  if (user.companyId === project.companyId) {
    return true;
  }

  // Check junction table
  const userCompany = await db
    .select()
    .from(userCompanies)
    .where(
      sql`${userCompanies.userId} = ${user.id} AND ${userCompanies.companyId} = ${project.companyId}`
    )
    .limit(1);

  return userCompany.length > 0;
}

export async function getProjectWithCompany(projectId: string) {
  const result = await db
    .select({
      project: projects,
      company: companies,
    })
    .from(projects)
    .innerJoin(companies, eq(projects.companyId, companies.id))
    .where(eq(projects.id, projectId))
    .limit(1);

  return result[0] || null;
}

export async function getProjectWithCompanyBySlug(slug: string) {
  const result = await db
    .select({
      project: projects,
      company: companies,
    })
    .from(projects)
    .innerJoin(companies, eq(projects.companyId, companies.id))
    .where(eq(projects.slug, slug))
    .limit(1);

  return result[0] || null;
}

export async function createHourRegistration(
  userId: string,
  description: string,
  hours: number,
  projectId?: string | null,
  contactId?: string | null,
  date?: Date,
  category:
    | "client"
    | "administration"
    | "brainstorming"
    | "research"
    | "labs"
    | "client_acquisition"
    | "content_creation"
    | "traveling" = "client"
) {
  const [registration] = await db
    .insert(hourRegistrations)
    .values({
      userId,
      projectId: projectId || null,
      contactId: contactId || null,
      description,
      hours: hours.toString(),
      category,
      date: date || new Date(),
    })
    .returning();

  return registration;
}

export async function getHourRegistrationsByUser(
  userId: string,
  options?: {
    limit?: number;
    offset?: number;
    search?: string;
    startDate?: Date;
    endDate?: Date;
  }
) {
  // Build where clause
  const conditions = [eq(hourRegistrations.userId, userId)];

  if (options?.startDate) {
    conditions.push(gte(hourRegistrations.date, options.startDate));
  }
  if (options?.endDate) {
    conditions.push(lte(hourRegistrations.date, options.endDate));
  }

  if (options?.search) {
    const searchTerm = `%${options.search.toLowerCase()}%`;
    conditions.push(
      or(
        like(sql`LOWER(${hourRegistrations.description})`, searchTerm),
        like(sql`LOWER(${users.name})`, searchTerm),
        like(sql`LOWER(${users.email})`, searchTerm),
        like(sql`LOWER(${projects.title})`, searchTerm)
      )!
    );
  }

  const whereClause =
    conditions.length > 1 ? and(...conditions)! : conditions[0];

  let query = db
    .select({
      id: hourRegistrations.id,
      userId: hourRegistrations.userId,
      projectId: hourRegistrations.projectId,
      contactId: hourRegistrations.contactId,
      description: hourRegistrations.description,
      hours: hourRegistrations.hours,
      category: hourRegistrations.category,
      date: hourRegistrations.date,
      createdAt: hourRegistrations.createdAt,
      updatedAt: hourRegistrations.updatedAt,
      project: {
        id: projects.id,
        title: projects.title,
        type: projects.type,
      },
      user: {
        id: users.id,
        name: users.name,
        email: users.email,
        imageStoragePath: users.imageStoragePath,
      },
    })
    .from(hourRegistrations)
    .leftJoin(projects, eq(hourRegistrations.projectId, projects.id))
    .innerJoin(users, eq(hourRegistrations.userId, users.id))
    .where(whereClause)
    .orderBy(desc(hourRegistrations.date));

  // Add pagination
  if (options?.limit) {
    query = query.limit(options.limit) as typeof query;
  }
  if (options?.offset) {
    query = query.offset(options.offset) as typeof query;
  }

  return await query;
}

// Get total count for pagination
export async function getHourRegistrationsCountByUser(
  userId: string,
  search?: string,
  startDate?: Date,
  endDate?: Date
) {
  // Build where clause
  const conditions = [eq(hourRegistrations.userId, userId)];

  if (startDate) {
    conditions.push(gte(hourRegistrations.date, startDate));
  }
  if (endDate) {
    conditions.push(lte(hourRegistrations.date, endDate));
  }

  if (search) {
    const searchTerm = `%${search.toLowerCase()}%`;
    conditions.push(
      or(
        like(sql`LOWER(${hourRegistrations.description})`, searchTerm),
        like(sql`LOWER(${users.name})`, searchTerm),
        like(sql`LOWER(${users.email})`, searchTerm),
        like(sql`LOWER(${projects.title})`, searchTerm)
      )!
    );
  }

  const whereClause =
    conditions.length > 1 ? and(...conditions)! : conditions[0];

  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(hourRegistrations)
    .leftJoin(projects, eq(hourRegistrations.projectId, projects.id))
    .innerJoin(users, eq(hourRegistrations.userId, users.id))
    .where(whereClause);

  return Number(result[0]?.count || 0);
}

// Get all hour registrations (for admin)
export async function getAllHourRegistrations(options?: {
  limit?: number;
  offset?: number;
  search?: string;
  startDate?: Date;
  endDate?: Date;
}) {
  // Build where clause
  const conditions: ReturnType<typeof and>[] = [];

  if (options?.startDate) {
    conditions.push(gte(hourRegistrations.date, options.startDate));
  }
  if (options?.endDate) {
    conditions.push(lte(hourRegistrations.date, options.endDate));
  }

  if (options?.search) {
    const searchTerm = `%${options.search.toLowerCase()}%`;
    conditions.push(
      or(
        like(sql`LOWER(${hourRegistrations.description})`, searchTerm),
        like(sql`LOWER(${users.name})`, searchTerm),
        like(sql`LOWER(${users.email})`, searchTerm),
        like(sql`LOWER(${projects.title})`, searchTerm)
      )!
    );
  }

  const whereClause =
    conditions.length > 0
      ? conditions.length > 1
        ? and(...conditions)!
        : conditions[0]
      : undefined;

  let query = db
    .select({
      id: hourRegistrations.id,
      userId: hourRegistrations.userId,
      projectId: hourRegistrations.projectId,
      contactId: hourRegistrations.contactId,
      description: hourRegistrations.description,
      hours: hourRegistrations.hours,
      category: hourRegistrations.category,
      date: hourRegistrations.date,
      createdAt: hourRegistrations.createdAt,
      updatedAt: hourRegistrations.updatedAt,
      project: {
        id: projects.id,
        title: projects.title,
        type: projects.type,
      },
      user: {
        id: users.id,
        name: users.name,
        email: users.email,
        imageStoragePath: users.imageStoragePath,
      },
    })
    .from(hourRegistrations)
    .leftJoin(projects, eq(hourRegistrations.projectId, projects.id))
    .innerJoin(users, eq(hourRegistrations.userId, users.id));

  if (whereClause) {
    query = query.where(whereClause) as typeof query;
  }

  query = query.orderBy(desc(hourRegistrations.date)) as typeof query;

  // Add pagination
  if (options?.limit) {
    query = query.limit(options.limit) as typeof query;
  }
  if (options?.offset) {
    query = query.offset(options.offset) as typeof query;
  }

  return await query;
}

// Get total count for pagination (all registrations)
export async function getAllHourRegistrationsCount(
  search?: string,
  startDate?: Date,
  endDate?: Date
) {
  const conditions: ReturnType<typeof and>[] = [];

  if (startDate) {
    conditions.push(gte(hourRegistrations.date, startDate));
  }
  if (endDate) {
    conditions.push(lte(hourRegistrations.date, endDate));
  }

  if (search) {
    const searchTerm = `%${search.toLowerCase()}%`;
    conditions.push(
      or(
        like(sql`LOWER(${hourRegistrations.description})`, searchTerm),
        like(sql`LOWER(${users.name})`, searchTerm),
        like(sql`LOWER(${users.email})`, searchTerm),
        like(sql`LOWER(${projects.title})`, searchTerm)
      )!
    );
  }

  const whereClause =
    conditions.length > 0
      ? conditions.length > 1
        ? and(...conditions)!
        : conditions[0]
      : undefined;

  let query = db
    .select({ count: sql<number>`count(*)` })
    .from(hourRegistrations)
    .leftJoin(projects, eq(hourRegistrations.projectId, projects.id))
    .innerJoin(users, eq(hourRegistrations.userId, users.id));

  if (whereClause) {
    query = query.where(whereClause) as typeof query;
  }

  const result = await query;
  return Number(result[0]?.count || 0);
}

export async function getHourRegistrationsByProject(projectId: string) {
  return await db
    .select()
    .from(hourRegistrations)
    .where(eq(hourRegistrations.projectId, projectId))
    .orderBy(desc(hourRegistrations.date));
}

export async function updateHourRegistration(
  registrationId: string,
  data: {
    description?: string;
    hours?: number;
    projectId?: string | null;
    contactId?: string | null;
    date?: Date;
    category?:
      | "client"
      | "administration"
      | "brainstorming"
      | "research"
      | "labs"
      | "client_acquisition"
      | "content_creation";
  }
) {
  const updateData: {
    description?: string;
    hours?: string;
    projectId?: string | null;
    contactId?: string | null;
    date?: Date;
    category?: string;
    updatedAt?: Date;
  } = {
    updatedAt: new Date(),
  };
  if (data.description !== undefined) updateData.description = data.description;
  if (data.hours !== undefined) updateData.hours = data.hours.toString();
  if (data.projectId !== undefined) updateData.projectId = data.projectId;
  if (data.contactId !== undefined) updateData.contactId = data.contactId;
  if (data.date !== undefined) updateData.date = data.date;
  if (data.category !== undefined) updateData.category = data.category;

  const [registration] = await db
    .update(hourRegistrations)
    .set(updateData)
    .where(eq(hourRegistrations.id, registrationId))
    .returning();

  return registration;
}

export async function deleteHourRegistration(registrationId: string) {
  await db
    .delete(hourRegistrations)
    .where(eq(hourRegistrations.id, registrationId));
}

export async function createCompany(data: {
  name: string;
  imageStoragePath?: string | null; // Path in Supabase Storage
  imageSizeBytes?: number | null;
  address?: string | null;
  kvkNumber?: string | null;
  btwNumber?: string | null;
  email?: string | null;
  telephone?: string | null;
  type?: string | null;
}) {
  const [company] = await db
    .insert(companies)
    .values({
      name: data.name,
      imageStoragePath: data.imageStoragePath || null,
      imageSizeBytes: data.imageSizeBytes || null,
      address: data.address || null,
      kvkNumber: data.kvkNumber || null,
      btwNumber: data.btwNumber || null,
      email: data.email || null,
      telephone: data.telephone || null,
      type: data.type || "client",
    })
    .returning();

  return company;
}

export async function updateCompany(
  companyId: string,
  data: {
    name?: string;
    imageStoragePath?: string | null; // Path in Supabase Storage
    imageSizeBytes?: number | null;
    address?: string | null;
    kvkNumber?: string | null;
    btwNumber?: string | null;
    email?: string | null;
    telephone?: string | null;
    type?: string | null;
  }
) {
  const [updatedCompany] = await db
    .update(companies)
    .set({
      ...(data.name !== undefined && { name: data.name }),
      ...(data.imageStoragePath !== undefined && {
        imageStoragePath: data.imageStoragePath,
      }),
      ...(data.imageSizeBytes !== undefined && {
        imageSizeBytes: data.imageSizeBytes,
      }),
      ...(data.address !== undefined && { address: data.address }),
      ...(data.kvkNumber !== undefined && { kvkNumber: data.kvkNumber }),
      ...(data.btwNumber !== undefined && { btwNumber: data.btwNumber }),
      ...(data.email !== undefined && { email: data.email }),
      ...(data.telephone !== undefined && { telephone: data.telephone }),
      ...(data.type !== undefined && data.type !== null && { type: data.type }),
      updatedAt: new Date(),
    })
    .where(eq(companies.id, companyId))
    .returning();

  return updatedCompany;
}

export async function getAllCompanies() {
  // CRITICAL: Exclude image Base64 data from list queries to avoid transferring large data
  const companyList = await db
    .select({
      id: companies.id,
      name: companies.name,
      imageStoragePath: companies.imageStoragePath, // Path string is safe to include
      imageSizeBytes: companies.imageSizeBytes,
      address: companies.address,
      kvkNumber: companies.kvkNumber,
      btwNumber: companies.btwNumber,
      email: companies.email,
      telephone: companies.telephone,
      type: companies.type,
      createdAt: companies.createdAt,
      updatedAt: companies.updatedAt,
    })
    .from(companies)
    .orderBy(companies.name);

  // Get contact counts for each company (from contact_companies junction)
  const contactCounts = await db
    .select({
      companyId: contactCompanies.companyId,
      count: sql<number>`COUNT(*)::int`.as("count"),
    })
    .from(contactCompanies)
    .groupBy(contactCompanies.companyId);

  const contactCountMap: Record<string, number> = {};
  contactCounts.forEach((row) => {
    if (row.companyId) {
      contactCountMap[row.companyId] = row.count;
    }
  });

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

  return companyList.map((company) => ({
    ...company,
    contactCount: contactCountMap[company.id] || 0,
    projectCount: projectCountMap[company.id] || 0,
    totalRevenue: revenueMap[company.id] || "0",
  }));
}

export async function getCompanyById(companyId: string) {
  const company = await db
    .select()
    .from(companies)
    .where(eq(companies.id, companyId))
    .limit(1);

  return company[0] || null;
}

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
  const yearStartStr = yearStart.toISOString();
  const yearEndStr = yearEnd.toISOString();

  const invoiceAggregations = await db
    .select({
      paidAllTime:
        sql<string>`COALESCE(SUM(CASE WHEN ${invoices.status} = 'paid' THEN CAST(${invoices.amount} AS DECIMAL(12,2)) ELSE 0 END), 0)::text`.as(
          "paid_all_time"
        ),
      outstandingAllTime:
        sql<string>`COALESCE(SUM(CASE WHEN ${invoices.status} IN ('sent', 'overdue') THEN CAST(${invoices.amount} AS DECIMAL(12,2)) ELSE 0 END), 0)::text`.as(
          "outstanding_all_time"
        ),
      paidCurrentYear:
        sql<string>`COALESCE(SUM(CASE WHEN ${invoices.status} = 'paid' AND ${invoices.invoiceDate} >= ${yearStartStr} AND ${invoices.invoiceDate} < ${yearEndStr} THEN CAST(${invoices.amount} AS DECIMAL(12,2)) ELSE 0 END), 0)::text`.as(
          "paid_current_year"
        ),
      outstandingCurrentYear:
        sql<string>`COALESCE(SUM(CASE WHEN ${invoices.status} IN ('sent', 'overdue') AND ${invoices.invoiceDate} >= ${yearStartStr} AND ${invoices.invoiceDate} < ${yearEndStr} THEN CAST(${invoices.amount} AS DECIMAL(12,2)) ELSE 0 END), 0)::text`.as(
          "outstanding_current_year"
        ),
    })
    .from(invoices)
    .where(eq(invoices.companyId, companyId));

  const revenue = invoiceAggregations[0] ?? {
    paidAllTime: "0",
    outstandingAllTime: "0",
    paidCurrentYear: "0",
    outstandingCurrentYear: "0",
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

export async function getCompaniesByNameOrBtw(
  vendorName?: string | null,
  btwNumber?: string | null
) {
  const hasName = vendorName?.trim();
  const hasBtw = btwNumber?.trim();
  if (!hasName && !hasBtw) return [];

  const conditions: ReturnType<typeof like>[] = [];
  if (hasName) {
    conditions.push(like(companies.name, `%${hasName}%`));
  }
  if (hasBtw) {
    const normalized = hasBtw.replace(/\s/g, "");
    conditions.push(like(companies.btwNumber, `%${normalized}%`));
  }

  const results = await db
    .select({
      id: companies.id,
      name: companies.name,
      btwNumber: companies.btwNumber,
      kvkNumber: companies.kvkNumber,
    })
    .from(companies)
    .where(or(...conditions))
    .limit(10);

  return results;
}

export async function createContact(data: {
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  photo?: string | null;
  companyId?: string | null;
  companyIds?: string[] | null;
  type?: string | null;
}) {
  const companyIds =
    data.companyIds && data.companyIds.length > 0
      ? data.companyIds
      : data.companyId
        ? [data.companyId]
        : [];
  const primaryCompanyId = companyIds[0] || data.companyId || null;

  const [contact] = await db
    .insert(contacts)
    .values({
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email || null,
      phone: data.phone || null,
      photo: data.photo || null,
      companyId: primaryCompanyId,
      type: data.type || "client",
    })
    .returning();

  if (companyIds.length > 0) {
    await db.insert(contactCompanies).values(
      companyIds.map((companyId) => ({
        contactId: contact.id,
        companyId,
      }))
    );
  }

  return contact;
}

export async function updateContact(
  contactId: string,
  data: {
    firstName?: string;
    lastName?: string;
    email?: string | null;
    phone?: string | null;
    photo?: string | null;
    companyId?: string | null;
    companyIds?: string[] | null;
    type?: string | null;
  }
) {
  if (data.companyIds !== undefined) {
    await db
      .delete(contactCompanies)
      .where(eq(contactCompanies.contactId, contactId));
    const ids =
      data.companyIds && data.companyIds.length > 0 ? data.companyIds : [];
    if (ids.length > 0) {
      await db
        .insert(contactCompanies)
        .values(ids.map((companyId) => ({ contactId, companyId })));
    }
    data.companyId = ids[0] || null;
  }

  const [updatedContact] = await db
    .update(contacts)
    .set({
      ...(data.firstName !== undefined && { firstName: data.firstName }),
      ...(data.lastName !== undefined && { lastName: data.lastName }),
      ...(data.email !== undefined && { email: data.email }),
      ...(data.phone !== undefined && { phone: data.phone }),
      ...(data.photo !== undefined && { photo: data.photo }),
      ...(data.companyId !== undefined && { companyId: data.companyId }),
      ...(data.type !== undefined && data.type !== null && { type: data.type }),
    })
    .where(eq(contacts.id, contactId))
    .returning();

  return updatedContact;
}

export async function getAllContacts() {
  const contactRows = await db
    .select({
      id: contacts.id,
      firstName: contacts.firstName,
      lastName: contacts.lastName,
      email: contacts.email,
      phone: contacts.phone,
      photo: contacts.photo,
      companyId: contacts.companyId,
      type: contacts.type,
      createdAt: contacts.createdAt,
    })
    .from(contacts)
    .orderBy(contacts.lastName, contacts.firstName);

  if (contactRows.length === 0) return [];

  const contactIds = contactRows.map((c) => c.id);
  const userImageRows = await db
    .select({
      contactId: users.contactId,
      imageStoragePath: users.imageStoragePath,
    })
    .from(users)
    .where(inArray(users.contactId, contactIds));
  const imageByContactId = Object.fromEntries(
    userImageRows
      .filter((r) => r.contactId && r.imageStoragePath)
      .map((r) => [r.contactId!, r.imageStoragePath!])
  );

  const ccRows = await db
    .select({
      contactId: contactCompanies.contactId,
      companyId: contactCompanies.companyId,
      companyName: companies.name,
    })
    .from(contactCompanies)
    .innerJoin(companies, eq(contactCompanies.companyId, companies.id))
    .where(inArray(contactCompanies.contactId, contactIds));

  // Fallback: contacts with companyId but not in contact_companies (legacy)
  const legacyCompanyIds = contactRows
    .filter((c) => c.companyId)
    .map((c) => c.companyId as string);
  const legacyCompanies =
    legacyCompanyIds.length > 0
      ? await db
          .select({ id: companies.id, name: companies.name })
          .from(companies)
          .where(inArray(companies.id, legacyCompanyIds))
      : [];

  const companiesByContactId: Record<
    string,
    Array<{ id: string; name: string }>
  > = {};
  ccRows.forEach((row) => {
    if (!companiesByContactId[row.contactId]) {
      companiesByContactId[row.contactId] = [];
    }
    companiesByContactId[row.contactId].push({
      id: row.companyId,
      name: row.companyName,
    });
  });

  const legacyMap = Object.fromEntries(
    legacyCompanies.map((c) => [c.id, c.name])
  );

  return contactRows.map((c) => {
    const companiesList = companiesByContactId[c.id];
    const companiesArray =
      companiesList && companiesList.length > 0
        ? companiesList
        : c.companyId && legacyMap[c.companyId]
          ? [{ id: c.companyId, name: legacyMap[c.companyId] }]
          : [];
    const hasImage = !!(c.photo || imageByContactId[c.id]);
    return {
      ...c,
      companyName: companiesArray[0]?.name ?? null,
      companies: companiesArray,
      companyIds: companiesArray.map((x) => x.id),
      hasImage,
    };
  });
}

export async function getContactById(contactId: string) {
  const contact = await db
    .select()
    .from(contacts)
    .where(eq(contacts.id, contactId))
    .limit(1);

  return contact[0] || null;
}

export async function deleteContact(contactId: string) {
  await db.delete(contacts).where(eq(contacts.id, contactId));
}

export async function getContactByEmail(email: string) {
  const contact = await db
    .select()
    .from(contacts)
    .where(eq(contacts.email, email))
    .limit(1);

  return contact[0] || null;
}

export async function createUser(
  email: string,
  name: string | null,
  companyIds: string[] | null,
  imageStoragePath?: string | null, // Path in Supabase Storage
  imageSizeBytes?: number | null,
  phone?: string | null,
  note?: string | null,
  contactId?: string | null
) {
  // Create user with first company as primary (for backward compatibility)
  let primaryCompanyId =
    companyIds && companyIds.length > 0 ? companyIds[0] : null;

  // If contactId provided, derive company from contact if not set
  if (contactId && !primaryCompanyId) {
    const contact = await getContactById(contactId);
    if (contact?.companyId) {
      primaryCompanyId = contact.companyId;
      companyIds = companyIds || [contact.companyId];
    }
  }

  const [newUser] = await db
    .insert(users)
    .values({
      email,
      name: name || null,
      phone: phone || null,
      note: note || null,
      imageStoragePath: imageStoragePath || null,
      imageSizeBytes: imageSizeBytes || null,
      companyId: primaryCompanyId,
      contactId: contactId || null,
    })
    .returning();

  // Add all companies to the junction table
  if (companyIds && companyIds.length > 0) {
    await db.insert(userCompanies).values(
      companyIds.map((companyId) => ({
        userId: newUser.id,
        companyId,
      }))
    );
  }

  return newUser;
}

export async function updateUser(
  userId: string,
  data: Partial<{
    name: string | null;
    companyId: string | null;
    companyIds?: string[] | null;
    contactId: string | null;
    imageStoragePath?: string | null; // Path in Supabase Storage
    imageSizeBytes?: number | null;
    phone: string | null;
    note: string | null;
  }>
) {
  // If companyIds is provided, update the junction table
  if (data.companyIds !== undefined) {
    // Delete existing relationships
    await db.delete(userCompanies).where(eq(userCompanies.userId, userId));

    // Add new relationships
    if (data.companyIds && data.companyIds.length > 0) {
      await db.insert(userCompanies).values(
        data.companyIds.map((companyId) => ({
          userId,
          companyId,
        }))
      );

      // Update primary companyId for backward compatibility
      data.companyId = data.companyIds[0];
    } else {
      data.companyId = null;
    }
  }

  const updateData: Partial<{
    name: string | null;
    companyId: string | null;
    contactId: string | null;
    imageStoragePath: string | null;
    imageSizeBytes: number | null;
    phone: string | null;
    note: string | null;
    updatedAt: Date;
  }> = {
    ...(data.name !== undefined && { name: data.name }),
    ...(data.companyId !== undefined && {
      companyId: data.companyId,
    }),
    ...(data.contactId !== undefined && {
      contactId: data.contactId,
    }),
    ...(data.imageStoragePath !== undefined && {
      imageStoragePath: data.imageStoragePath,
    }),
    ...(data.imageSizeBytes !== undefined && {
      imageSizeBytes: data.imageSizeBytes,
    }),
    ...(data.phone !== undefined && { phone: data.phone }),
    ...(data.note !== undefined && { note: data.note }),
    updatedAt: new Date(),
  };

  const [updatedUser] = await db
    .update(users)
    .set(updateData)
    .where(eq(users.id, userId))
    .returning();

  return updatedUser;
}

export async function getAllUsers() {
  // CRITICAL: Exclude image Base64 data from list queries to avoid transferring large data
  // Get all users with their primary company and linked contact
  const usersWithPrimaryCompany = await db
    .select({
      user: {
        id: users.id,
        email: users.email,
        name: users.name,
        phone: users.phone,
        note: users.note,
        imageStoragePath: users.imageStoragePath, // Path string is safe to include
        imageSizeBytes: users.imageSizeBytes,
        companyId: users.companyId,
        contactId: users.contactId,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      },
      company: {
        id: companies.id,
        name: companies.name,
      },
      contact: {
        id: contacts.id,
        firstName: contacts.firstName,
        lastName: contacts.lastName,
        email: contacts.email,
      },
    })
    .from(users)
    .leftJoin(companies, eq(users.companyId, companies.id))
    .leftJoin(contacts, eq(users.contactId, contacts.id))
    .orderBy(users.email);

  // Get all user-company relationships
  const allUserCompanies = await db
    .select({
      userId: userCompanies.userId,
      company: {
        id: companies.id,
        name: companies.name,
      },
    })
    .from(userCompanies)
    .innerJoin(companies, eq(userCompanies.companyId, companies.id));

  // Group companies by user ID
  const companiesByUserId: Record<
    string,
    Array<{ id: string; name: string }>
  > = {};
  allUserCompanies.forEach((row) => {
    if (!companiesByUserId[row.userId]) {
      companiesByUserId[row.userId] = [];
    }
    companiesByUserId[row.userId].push(row.company);
  });

  // Combine results
  return usersWithPrimaryCompany.map((row) => ({
    user: row.user,
    company: row.company,
    contact: row.contact,
    companies: companiesByUserId[row.user.id] || [],
  }));
}

// Paginated version of getAllUsers
export async function getAllUsersPaginated(options?: {
  limit?: number;
  offset?: number;
  companyId?: string;
  search?: string;
}) {
  // CRITICAL: Exclude image Base64 data from list queries to avoid transferring large data
  // Get paginated users with their primary company and linked contact
  let query = db
    .select({
      user: {
        id: users.id,
        email: users.email,
        name: users.name,
        phone: users.phone,
        note: users.note,
        imageStoragePath: users.imageStoragePath, // Path string is safe to include
        imageSizeBytes: users.imageSizeBytes,
        companyId: users.companyId,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      },
      company: {
        id: companies.id,
        name: companies.name,
      },
      contact: {
        id: contacts.id,
        firstName: contacts.firstName,
        lastName: contacts.lastName,
        email: contacts.email,
      },
    })
    .from(users)
    .leftJoin(companies, eq(users.companyId, companies.id))
    .leftJoin(contacts, eq(users.contactId, contacts.id));

  // Apply filters
  const conditions = [];
  if (options?.companyId) {
    // Filter by company - check both primary company and junction table
    const userOrgIds = await db
      .select({ userId: userCompanies.userId })
      .from(userCompanies)
      .where(eq(userCompanies.companyId, options.companyId));
    const userIds = userOrgIds.map((row) => row.userId);

    // Also include users with this as primary company
    if (userIds.length > 0) {
      conditions.push(
        or(eq(users.companyId, options.companyId), inArray(users.id, userIds))!
      );
    } else {
      // If no users in junction table, only check primary company
      conditions.push(eq(users.companyId, options.companyId));
    }
  }
  if (options?.search) {
    const searchTerm = `%${options.search.toLowerCase()}%`;
    conditions.push(
      or(
        like(sql`LOWER(${users.email})`, searchTerm),
        like(sql`LOWER(${users.name})`, searchTerm),
        like(sql`LOWER(${companies.name})`, searchTerm),
        like(sql`LOWER(${contacts.firstName})`, searchTerm),
        like(sql`LOWER(${contacts.lastName})`, searchTerm),
        like(sql`LOWER(${contacts.email})`, searchTerm)
      )!
    );
  }

  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as typeof query;
  }

  query = query.orderBy(users.email) as typeof query;

  if (options?.limit) {
    query = query.limit(options.limit) as typeof query;
  }
  if (options?.offset) {
    query = query.offset(options.offset) as typeof query;
  }

  const usersWithPrimaryOrg = await query;

  // Get user IDs for the paginated users
  const userIds = usersWithPrimaryOrg.map((row) => row.user.id);

  // Get all user-company relationships for these users
  const allUserOrgs =
    userIds.length > 0
      ? await db
          .select({
            userId: userCompanies.userId,
            company: companies,
          })
          .from(userCompanies)
          .innerJoin(companies, eq(userCompanies.companyId, companies.id))
          .where(inArray(userCompanies.userId, userIds))
      : [];

  // Group companies by user ID
  const orgsByUserId: Record<string, (typeof companies.$inferSelect)[]> = {};
  allUserOrgs.forEach((row) => {
    if (!orgsByUserId[row.userId]) {
      orgsByUserId[row.userId] = [];
    }
    orgsByUserId[row.userId].push(row.company);
  });

  // Combine results - use organization/organizations for API compatibility with frontend
  return usersWithPrimaryOrg.map((row) => ({
    user: row.user,
    organization: row.company,
    organizations: (orgsByUserId[row.user.id] || []).map((c) => ({
      id: c.id,
      name: c.name,
    })),
    contact: row.contact?.id
      ? {
          id: row.contact.id,
          firstName: row.contact.firstName,
          lastName: row.contact.lastName,
          email: row.contact.email,
        }
      : null,
  }));
}

// Get total count of users with optional filters
export async function getAllUsersCount(filters?: {
  companyId?: string;
  search?: string;
}) {
  let query = db
    .select({ count: sql<number>`count(*)` })
    .from(users)
    .leftJoin(companies, eq(users.companyId, companies.id))
    .leftJoin(contacts, eq(users.contactId, contacts.id));

  const conditions = [];
  if (filters?.companyId) {
    // Filter by company - check both primary company and junction table
    const userOrgIds = await db
      .select({ userId: userCompanies.userId })
      .from(userCompanies)
      .where(eq(userCompanies.companyId, filters.companyId));
    const userIds = userOrgIds.map((row) => row.userId);

    // Also include users with this as primary company
    if (userIds.length > 0) {
      conditions.push(
        or(eq(users.companyId, filters.companyId), inArray(users.id, userIds))!
      );
    } else {
      // If no users in junction table, only check primary company
      conditions.push(eq(users.companyId, filters.companyId));
    }
  }
  if (filters?.search) {
    const searchTerm = `%${filters.search.toLowerCase()}%`;
    conditions.push(
      or(
        like(sql`LOWER(${users.email})`, searchTerm),
        like(sql`LOWER(${users.name})`, searchTerm),
        like(sql`LOWER(${companies.name})`, searchTerm),
        like(sql`LOWER(${contacts.firstName})`, searchTerm),
        like(sql`LOWER(${contacts.lastName})`, searchTerm),
        like(sql`LOWER(${contacts.email})`, searchTerm)
      )!
    );
  }

  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as typeof query;
  }

  const result = await query;
  return Number(result[0]?.count || 0);
}

export async function createProject(data: {
  title: string;
  description?: string | null;
  status?: string;
  stage?: string;
  startDate?: Date | null;
  deadline?: Date | null;
  subtotal?: string | null;
  currency?: string;
  type?: "client" | "labs";
  companyId: string;
}) {
  const slug = slugify(data.title, generateSlugSuffix());
  const [project] = await db
    .insert(projects)
    .values({
      slug,
      title: data.title,
      description: data.description || null,
      status: data.status || "active",
      stage: data.stage || "kick_off",
      startDate: data.startDate || null,
      deadline: data.deadline || null,
      subtotal: data.subtotal || null,
      currency: data.currency || "EUR",
      type: data.type || "client",
      companyId: data.companyId,
    })
    .returning();

  return project;
}

export async function getAllProjects() {
  return await db
    .select({
      project: {
        id: projects.id,
        slug: projects.slug,
        title: projects.title,
        description: projects.description,
        status: projects.status,
        stage: projects.stage,
        startDate: projects.startDate,
        deadline: projects.deadline,
        subtotal: projects.subtotal,
        currency: projects.currency,
        type: projects.type,
        companyId: projects.companyId,
        createdAt: projects.createdAt,
        updatedAt: projects.updatedAt,
      },
      company: {
        id: companies.id,
        name: companies.name,
      },
    })
    .from(projects)
    .innerJoin(companies, eq(projects.companyId, companies.id))
    .orderBy(desc(projects.createdAt));
}

// Paginated version of getAllProjects
export async function getAllProjectsPaginated(options?: {
  limit?: number;
  offset?: number;
  status?: string;
  type?: string;
  search?: string;
}) {
  let query = db
    .select({
      project: {
        id: projects.id,
        slug: projects.slug,
        title: projects.title,
        description: projects.description,
        status: projects.status,
        stage: projects.stage,
        startDate: projects.startDate,
        deadline: projects.deadline,
        subtotal: projects.subtotal,
        currency: projects.currency,
        type: projects.type,
        companyId: projects.companyId,
        createdAt: projects.createdAt,
        updatedAt: projects.updatedAt,
      },
      company: {
        id: companies.id,
        name: companies.name,
      },
    })
    .from(projects)
    .innerJoin(companies, eq(projects.companyId, companies.id));

  // Apply filters
  const conditions = [];
  if (options?.status) {
    conditions.push(eq(projects.status, options.status));
  }
  if (options?.type) {
    conditions.push(eq(projects.type, options.type));
  }
  if (options?.search) {
    const searchTerm = `%${options.search.toLowerCase()}%`;
    conditions.push(
      or(
        like(sql`LOWER(${projects.title})`, searchTerm),
        like(sql`LOWER(${companies.name})`, searchTerm),
        like(sql`LOWER(${projects.description})`, searchTerm)
      )!
    );
  }

  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as typeof query;
  }

  query = query.orderBy(desc(projects.createdAt)) as typeof query;

  if (options?.limit) {
    query = query.limit(options.limit) as typeof query;
  }
  if (options?.offset) {
    query = query.offset(options.offset) as typeof query;
  }

  return await query;
}

// Get total count of projects with optional filters
export async function getAllProjectsCount(filters?: {
  status?: string;
  type?: string;
  search?: string;
}) {
  let query = db
    .select({ count: sql<number>`count(*)` })
    .from(projects)
    .innerJoin(companies, eq(projects.companyId, companies.id));

  const conditions = [];
  if (filters?.status) {
    conditions.push(eq(projects.status, filters.status));
  }
  if (filters?.type) {
    conditions.push(eq(projects.type, filters.type));
  }
  if (filters?.search) {
    const searchTerm = `%${filters.search.toLowerCase()}%`;
    conditions.push(
      or(
        like(sql`LOWER(${projects.title})`, searchTerm),
        like(sql`LOWER(${companies.name})`, searchTerm),
        like(sql`LOWER(${projects.description})`, searchTerm)
      )!
    );
  }

  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as typeof query;
  }

  const result = await query;
  return Number(result[0]?.count || 0);
}

export async function getClientProjects() {
  return await db
    .select({
      project: {
        id: projects.id,
        title: projects.title,
        description: projects.description,
        status: projects.status,
        stage: projects.stage,
        startDate: projects.startDate,
        deadline: projects.deadline,
        subtotal: projects.subtotal,
        currency: projects.currency,
        type: projects.type,
        companyId: projects.companyId,
        createdAt: projects.createdAt,
        updatedAt: projects.updatedAt,
      },
      company: {
        id: companies.id,
        name: companies.name,
      },
    })
    .from(projects)
    .innerJoin(companies, eq(projects.companyId, companies.id))
    .where(eq(projects.type, "client"))
    .orderBy(desc(projects.createdAt));
}

export async function getEXOLabsProjects() {
  return await db
    .select({
      project: {
        id: projects.id,
        title: projects.title,
        description: projects.description,
        status: projects.status,
        stage: projects.stage,
        startDate: projects.startDate,
        deadline: projects.deadline,
        subtotal: projects.subtotal,
        currency: projects.currency,
        type: projects.type,
        companyId: projects.companyId,
        createdAt: projects.createdAt,
        updatedAt: projects.updatedAt,
      },
      company: {
        id: companies.id,
        name: companies.name,
      },
    })
    .from(projects)
    .innerJoin(companies, eq(projects.companyId, companies.id))
    .where(eq(projects.type, "labs"))
    .orderBy(desc(projects.createdAt));
}

export async function updateProject(
  projectId: string,
  data: Partial<{
    title: string;
    description: string | null;
    status: string;
    stage: string;
    startDate: Date | null;
    deadline: Date | null;
    subtotal: string | null;
    currency: string;
    type: "client" | "labs";
  }>
) {
  const updateData: Record<string, unknown> = {
    ...data,
    updatedAt: new Date(),
  };

  // Regenerate slug when title changes
  if (data.title) {
    const existing = await getProjectById(projectId);
    const suffix =
      existing?.id?.toString().replace(/-/g, "").slice(0, 8) ??
      generateSlugSuffix();
    updateData.slug = slugify(data.title, suffix);
  }

  const [project] = await db
    .update(projects)
    .set(updateData)
    .where(eq(projects.id, projectId))
    .returning();

  return project;
}

export async function getTotalHoursByProject() {
  const result = await db
    .select({
      projectId: hourRegistrations.projectId,
      totalHours:
        sql<string>`COALESCE(SUM(${hourRegistrations.hours}::numeric), 0)`.as(
          "total_hours"
        ),
    })
    .from(hourRegistrations)
    .where(sql`${hourRegistrations.projectId} IS NOT NULL`)
    .groupBy(hourRegistrations.projectId);

  // Convert to a map for easy lookup
  const hoursMap: Record<string, number> = {};
  result.forEach((row) => {
    if (row.projectId) {
      hoursMap[row.projectId] = parseFloat(row.totalHours);
    }
  });

  return hoursMap;
}

export async function deleteCompany(companyId: string) {
  // Get the company first to check if it has a Storage image
  const company = await db
    .select({ imageStoragePath: companies.imageStoragePath })
    .from(companies)
    .where(eq(companies.id, companyId))
    .limit(1);

  // Delete the company
  await db.delete(companies).where(eq(companies.id, companyId));

  // Delete the image from Storage if it exists
  if (company[0]?.imageStoragePath) {
    try {
      const { deleteCompanyImage } = await import("@/lib/utils/image-storage");
      await deleteCompanyImage(company[0].imageStoragePath);
    } catch (error) {
      // Log error but don't fail the deletion if Storage deletion fails
      console.error("Error deleting company image from Storage:", error);
    }
  }
}

export async function deleteUser(userId: string) {
  // Get the user first to check if it has a Storage image
  const user = await db
    .select({ imageStoragePath: users.imageStoragePath })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  // Delete the user
  await db.delete(users).where(eq(users.id, userId));

  // Delete the image from Storage if it exists
  if (user[0]?.imageStoragePath) {
    try {
      const { deleteUserImage } = await import("@/lib/utils/image-storage");
      await deleteUserImage(user[0].imageStoragePath);
    } catch (error) {
      // Log error but don't fail the deletion if Storage deletion fails
      console.error("Error deleting user image from Storage:", error);
    }
  }
}

export async function deleteProject(projectId: string) {
  await db.delete(projects).where(eq(projects.id, projectId));
}

// Exchange rate caching
let eurToUsdRate: number | null = null;
let rateCacheTimestamp: number = 0;
const RATE_CACHE_DURATION = 3600000; // 1 hour in milliseconds

// Fetch EUR to USD exchange rate from free API
async function getEurToUsdRate(): Promise<number> {
  const now = Date.now();

  // Return cached rate if still valid
  if (eurToUsdRate && now - rateCacheTimestamp < RATE_CACHE_DURATION) {
    return eurToUsdRate;
  }

  try {
    // Using exchangerate-api.com free endpoint (no auth required)
    const response = await fetch(
      "https://api.exchangerate-api.com/v4/latest/EUR",
      {
        next: { revalidate: 3600 }, // Revalidate every hour
      }
    );

    if (!response.ok) {
      throw new Error("Failed to fetch exchange rate");
    }

    const data = await response.json();
    const rate = data.rates?.USD;

    if (!rate || typeof rate !== "number") {
      throw new Error("Invalid exchange rate data");
    }

    eurToUsdRate = rate;
    rateCacheTimestamp = now;
    return rate;
  } catch (error) {
    console.error("Error fetching EUR to USD rate:", error);
    // Fallback to approximate rate if API fails
    if (!eurToUsdRate) {
      eurToUsdRate = 1.08; // Approximate fallback rate
    }
    return eurToUsdRate;
  }
}

// Helper function to parse invoice amount (removes currency symbols).
// Handles both US format (1,234.56) and European format (1.234,56 or 3.500).
function parseInvoiceAmount(amount: string | null | undefined): number {
  if (!amount) return 0;
  const cleaned = amount.replace(/[€$\s]/g, "").trim();
  if (!cleaned) return 0;

  const lastComma = cleaned.lastIndexOf(",");
  const lastPeriod = cleaned.lastIndexOf(".");

  if (lastComma > lastPeriod) {
    // European: 1.234,56 (period = thousands, comma = decimal)
    const normalized = cleaned.replace(/\./g, "").replace(",", ".");
    const parsed = parseFloat(normalized);
    return isNaN(parsed) ? 0 : parsed;
  }
  if (lastPeriod >= 0) {
    const afterPeriod = cleaned.slice(lastPeriod + 1).replace(/,/g, "");
    // European thousands: 3.500 = 3500 (exactly 3 digits after period, no comma)
    if (lastComma < 0 && /^\d{3}$/.test(afterPeriod)) {
      const normalized = cleaned.replace(/\./g, "");
      const parsed = parseFloat(normalized);
      return isNaN(parsed) ? 0 : parsed;
    }
    // US: 1,234.56 (comma = thousands, period = decimal)
    const normalized = cleaned.replace(/,/g, "");
    const parsed = parseFloat(normalized);
    return isNaN(parsed) ? 0 : parsed;
  }
  const parsed = parseFloat(cleaned.replace(/,/g, ""));
  return isNaN(parsed) ? 0 : parsed;
}

// Helper function to convert amount to EUR
async function convertToEUR(
  amount: number,
  currency: string,
  usdToEurRate?: number
): Promise<number> {
  if (currency === "USD") {
    // If rate is provided, use it; otherwise fetch it
    const rate = usdToEurRate ?? (await getEurToUsdRate());
    // Convert USD to EUR: divide by EUR/USD rate (e.g., if 1 EUR = 1.08 USD, then 1 USD = 1/1.08 EUR)
    return amount / rate;
  }
  return amount; // Already in EUR or default to EUR
}

export async function getDashboardStats(
  revenueTimeRange: string = "year",
  hoursTimeRange: string = "30d",
  clientDateStr?: string | null
) {
  // Use client's date when provided so "last 30 days" matches user's calendar (avoids server/client date mismatch)
  const now = (() => {
    if (clientDateStr && /^\d{4}-\d{2}-\d{2}$/.test(clientDateStr)) {
      const [y, m, d] = clientDateStr.split("-").map(Number);
      return new Date(y, m - 1, d, 12, 0, 0, 0);
    }
    return new Date();
  })();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    0,
    23,
    59,
    59,
    999
  );
  // Last 7 days (including today): from (today - 6) 00:00 to today 23:59
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - 6);
  startOfWeek.setHours(0, 0, 0, 0);
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);
  const startOfYear = new Date(now.getFullYear(), 0, 1);

  // Last 30 days (rolling window) - uses client date when provided
  const startOfLast30Days = new Date(now);
  startOfLast30Days.setDate(startOfLast30Days.getDate() - 30);
  startOfLast30Days.setHours(0, 0, 0, 0);
  const endOfLast30Days = new Date(now);
  endOfLast30Days.setHours(23, 59, 59, 999);
  const startOfPrev30Days = new Date(startOfLast30Days);
  startOfPrev30Days.setDate(startOfPrev30Days.getDate() - 30);
  const endOfPrev30Days = new Date(startOfLast30Days);
  endOfPrev30Days.setMilliseconds(endOfPrev30Days.getMilliseconds() - 1);

  // Fetch exchange rate once at the beginning to avoid multiple API calls
  const usdToEurRate = await getEurToUsdRate();

  // Revenue chart date range (needed for building revenueByDate in same loop)
  let revenueStartDate: Date;
  let revenueEndDate: Date = now;
  let revenueDaysToShow = 0;
  let revenueGroupByMonth = false;
  if (revenueTimeRange === "year") {
    revenueStartDate = new Date(now.getFullYear(), 0, 1);
    revenueEndDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
    revenueGroupByMonth = true;
  } else {
    const days =
      revenueTimeRange === "90d" ? 90 : revenueTimeRange === "30d" ? 30 : 7;
    revenueStartDate = new Date(now);
    revenueStartDate.setDate(revenueStartDate.getDate() - days);
    revenueStartDate.setHours(0, 0, 0, 0);
    revenueEndDate = new Date(now);
    revenueEndDate.setHours(23, 59, 59, 999);
    revenueDaysToShow = days;
  }

  // Get all paid invoices (excl. reimbursements)
  const paidInvoices = await db
    .select({
      id: invoices.id,
      amount: invoices.amount,
      currency: invoices.currency,
      transactionType: invoices.transactionType,
      isKOR: invoices.isKOR,
      dueDate: invoices.dueDate,
      paidAt: invoices.paidAt,
      createdAt: invoices.createdAt,
    })
    .from(invoices)
    .where(and(eq(invoices.status, "paid"), isNull(invoices.expenseId)));

  const paidInvoiceIds = paidInvoices.map((i) => i.id);
  const lineItemsForPaid =
    paidInvoiceIds.length > 0
      ? await db
          .select({
            invoiceId: invoiceLineItems.invoiceId,
            quantity: invoiceLineItems.quantity,
            unitPrice: invoiceLineItems.unitPrice,
            taxPercentage: invoiceLineItems.taxPercentage,
          })
          .from(invoiceLineItems)
          .where(inArray(invoiceLineItems.invoiceId, paidInvoiceIds))
          .orderBy(invoiceLineItems.order)
      : [];

  const lineItemsByInvoiceId = new Map<
    string,
    Array<{
      quantity: string | number;
      unitPrice: string | number;
      taxPercentage: string | number;
    }>
  >();
  for (const item of lineItemsForPaid) {
    const list = lineItemsByInvoiceId.get(item.invoiceId) ?? [];
    list.push({
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      taxPercentage: item.taxPercentage,
    });
    lineItemsByInvoiceId.set(item.invoiceId, list);
  }

  // Helper: compare by calendar date (YYYY-MM-DD) to avoid timezone/parsing edge cases
  const toDateStr = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  // Calculate revenue: sum of invoice totals (paid, non-reimbursement)
  let totalRevenue = 0;
  let revenueLast30Days = 0;
  let revenuePrev30Days = 0;
  let revenueThisMonth = 0; // Safeguard: last30Days can never be < current month
  const revenueByDate: { [key: string]: number } = {};

  const startStr = toDateStr(startOfLast30Days);
  const endStr = toDateStr(endOfLast30Days);
  const prevStartStr = toDateStr(startOfPrev30Days);
  const prevEndStr = toDateStr(endOfPrev30Days);
  const monthStartStr = toDateStr(startOfMonth);
  const monthEndStr = toDateStr(endOfMonth);

  for (const inv of paidInvoices) {
    const amount = parseInvoiceAmount(inv.amount);
    const lineItems = lineItemsByInvoiceId.get(inv.id) ?? [];
    const isKOR = inv.isKOR ?? false;

    // Revenue excl. BTW (consistent with financials page)
    const revenueExclVATInvoiceCurrency = getRevenueExcludingVAT(
      amount,
      lineItems,
      isKOR
    );
    const amountInEUR = await convertToEUR(
      revenueExclVATInvoiceCurrency,
      inv.currency || "EUR",
      usdToEurRate
    );
    const isDebit = (inv.transactionType || "debit") === "debit";
    const value = isDebit ? amountInEUR : -amountInEUR;

    // Use paidAt for all date-based logic (revenue = when received)
    const dateForPeriod = inv.paidAt
      ? new Date(inv.paidAt)
      : inv.dueDate
        ? new Date(inv.dueDate)
        : new Date(inv.createdAt);
    const dStr = toDateStr(dateForPeriod);

    totalRevenue += value;

    if (dStr >= startStr && dStr <= endStr) revenueLast30Days += value;
    if (dStr >= prevStartStr && dStr <= prevEndStr) revenuePrev30Days += value;
    if (dStr >= monthStartStr && dStr <= monthEndStr) revenueThisMonth += value;

    // Chart: group by date within selected range
    if (dateForPeriod >= revenueStartDate && dateForPeriod <= revenueEndDate) {
      const dateKey = revenueGroupByMonth
        ? `${dateForPeriod.getFullYear()}-${String(dateForPeriod.getMonth() + 1).padStart(2, "0")}`
        : dStr;
      revenueByDate[dateKey] = (revenueByDate[dateKey] || 0) + value;
    }
  }

  // Safeguard: last 30 days always includes current month, so it can never be less
  if (now.getDate() <= 30 && revenueLast30Days < revenueThisMonth) {
    revenueLast30Days = revenueThisMonth;
  }

  // Get total hours
  const totalHoursResult = await db
    .select({
      total:
        sql<string>`COALESCE(SUM(${hourRegistrations.hours}::numeric), 0)`.as(
          "total"
        ),
    })
    .from(hourRegistrations);

  const totalHours = parseFloat(totalHoursResult[0]?.total || "0");

  // Get hours last 30 days (rolling window)
  const hoursLast30DaysResult = await db
    .select({
      total:
        sql<string>`COALESCE(SUM(${hourRegistrations.hours}::numeric), 0)`.as(
          "total"
        ),
    })
    .from(hourRegistrations)
    .where(
      and(
        gte(hourRegistrations.date, startOfLast30Days),
        lte(hourRegistrations.date, endOfLast30Days)
      )
    );

  const hoursLast30Days = parseFloat(hoursLast30DaysResult[0]?.total || "0");

  // Get hours previous 30 days (for change calculation)
  const hoursPrev30DaysResult = await db
    .select({
      total:
        sql<string>`COALESCE(SUM(${hourRegistrations.hours}::numeric), 0)`.as(
          "total"
        ),
    })
    .from(hourRegistrations)
    .where(
      and(
        gte(hourRegistrations.date, startOfPrev30Days),
        lte(hourRegistrations.date, endOfPrev30Days)
      )
    );

  const hoursPrev30Days = parseFloat(hoursPrev30DaysResult[0]?.total || "0");

  // Get hours this week (last 7 days inclusive)
  const hoursThisWeekResult = await db
    .select({
      total:
        sql<string>`COALESCE(SUM(${hourRegistrations.hours}::numeric), 0)`.as(
          "total"
        ),
    })
    .from(hourRegistrations)
    .where(
      and(
        gte(hourRegistrations.date, startOfWeek),
        lte(hourRegistrations.date, endOfToday)
      )
    );

  const hoursThisWeek = parseFloat(hoursThisWeekResult[0]?.total || "0");

  // Get hours this year
  const hoursThisYearResult = await db
    .select({
      total:
        sql<string>`COALESCE(SUM(${hourRegistrations.hours}::numeric), 0)`.as(
          "total"
        ),
    })
    .from(hourRegistrations)
    .where(gte(hourRegistrations.date, startOfYear));

  const hoursThisYear = parseFloat(hoursThisYearResult[0]?.total || "0");

  // Get project counts
  const totalProjects = await db.select().from(projects);
  const activeProjects = totalProjects.filter((p) => p.status === "active");
  const completedProjects = totalProjects.filter(
    (p) => p.status === "completed"
  );

  // Get company and user counts (unused but kept for potential future use)
  // const allOrganizations = await db.select().from(companies);
  // const allUsers = await db.select().from(users);

  // Calculate percentage changes (last 30 days vs previous 30 days)
  const revenueChange =
    revenuePrev30Days > 0
      ? ((revenueLast30Days - revenuePrev30Days) / revenuePrev30Days) * 100
      : revenueLast30Days > 0
        ? 100
        : 0;

  const hoursChange =
    hoursPrev30Days > 0
      ? ((hoursLast30Days - hoursPrev30Days) / hoursPrev30Days) * 100
      : hoursLast30Days > 0
        ? 100
        : 0;

  // Generate revenue chart data
  const revenueChartData: { date: string; revenue: number }[] = [];
  if (revenueGroupByMonth) {
    // Generate data for all months of the current year
    for (let month = 0; month < 12; month++) {
      const date = new Date(now.getFullYear(), month, 1);
      const monthStr = `${date.getFullYear()}-${String(month + 1).padStart(2, "0")}`;
      const monthName = date.toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
      });
      revenueChartData.push({
        date: monthName,
        revenue: revenueByDate[monthStr] || 0,
      });
    }
  } else {
    // Generate data for the selected number of days
    for (let i = 0; i <= revenueDaysToShow; i++) {
      const date = new Date(revenueStartDate);
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split("T")[0];
      const day = date.getDate().toString().padStart(2, "0");
      const month = (date.getMonth() + 1).toString().padStart(2, "0");
      const year = date.getFullYear();
      revenueChartData.push({
        date: `${day}/${month}/${year}`,
        revenue: revenueByDate[dateStr] || 0,
      });
    }
  }

  // Calculate hours chart date range based on time range parameter
  let hoursStartDate: Date;
  let hoursEndDate: Date = now;
  let hoursDays = 0;
  let hoursGroupByMonth = false;

  if (hoursTimeRange === "year") {
    hoursStartDate = new Date(now.getFullYear(), 0, 1); // January 1st of current year
    hoursEndDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999); // December 31st
    hoursGroupByMonth = true;
  } else {
    hoursDays =
      hoursTimeRange === "90d" ? 90 : hoursTimeRange === "30d" ? 30 : 7;
    hoursStartDate = new Date(now);
    hoursStartDate.setDate(hoursStartDate.getDate() - hoursDays);
    hoursStartDate.setHours(0, 0, 0, 0); // Include full first day
    hoursEndDate = new Date(now);
    hoursEndDate.setHours(23, 59, 59, 999); // Include full last day
  }

  const hoursOverTime = await db
    .select({
      date: hourRegistrations.date,
      hours: hourRegistrations.hours,
    })
    .from(hourRegistrations)
    .where(
      and(
        gte(hourRegistrations.date, hoursStartDate),
        lte(hourRegistrations.date, hoursEndDate)
      )
    )
    .orderBy(hourRegistrations.date);

  // Group hours by date/month
  const hoursByDate: { [key: string]: number } = {};
  hoursOverTime.forEach((row) => {
    const rowDate = new Date(row.date);
    // Only include if within the selected time range
    if (rowDate >= hoursStartDate && rowDate <= hoursEndDate) {
      let dateKey: string;
      if (hoursGroupByMonth) {
        // Format as YYYY-MM for monthly grouping (UTC for consistency)
        dateKey = `${rowDate.getUTCFullYear()}-${String(rowDate.getUTCMonth() + 1).padStart(2, "0")}`;
      } else {
        // Format as YYYY-MM-DD for daily grouping (UTC for consistency)
        dateKey = rowDate.toISOString().split("T")[0];
      }
      hoursByDate[dateKey] =
        (hoursByDate[dateKey] || 0) + parseFloat(row.hours);
    }
  });

  // Generate hours chart data
  const hoursChartData: { date: string; hours: number }[] = [];
  if (hoursGroupByMonth) {
    // Generate data for all months of the current year
    for (let month = 0; month < 12; month++) {
      const date = new Date(now.getFullYear(), month, 1);
      const monthStr = `${date.getFullYear()}-${String(month + 1).padStart(2, "0")}`;
      const monthName = date.toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
      });
      hoursChartData.push({
        date: monthName,
        hours: hoursByDate[monthStr] || 0,
      });
    }
  } else {
    // Generate data for the selected number of days
    for (let i = 0; i <= hoursDays; i++) {
      const date = new Date(hoursStartDate);
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split("T")[0];
      const day = date.getDate().toString().padStart(2, "0");
      const month = (date.getMonth() + 1).toString().padStart(2, "0");
      const year = date.getFullYear();
      hoursChartData.push({
        date: `${day}/${month}/${year}`,
        hours: hoursByDate[dateStr] || 0,
      });
    }
  }

  // Get projects by stage for chart
  const projectsByStage = await db
    .select({
      stage: projects.stage,
    })
    .from(projects);

  // Define all possible stages
  const allStages = [
    "kick_off",
    "pay_first",
    "deliver",
    "revise",
    "pay_final",
    "completed",
  ];

  // Count projects by stage
  const stageCounts: { [key: string]: number } = {};
  allStages.forEach((stage) => {
    stageCounts[stage] = 0;
  });

  projectsByStage.forEach((row) => {
    if (stageCounts[row.stage] !== undefined) {
      stageCounts[row.stage] = (stageCounts[row.stage] || 0) + 1;
    }
  });

  const projectsChartData = allStages.map((stage) => ({
    stage: stage.charAt(0).toUpperCase() + stage.slice(1).replace(/_/g, " "),
    count: stageCounts[stage] || 0,
  }));

  return {
    revenue: {
      total: totalRevenue,
      last30Days: revenueLast30Days,
      change: revenueChange,
      chartData: revenueChartData,
    },
    hours: {
      total: totalHours,
      thisWeek: hoursThisWeek,
      last30Days: hoursLast30Days,
      thisYear: hoursThisYear,
      change: hoursChange,
      chartData: hoursChartData,
    },
    projects: {
      total: totalProjects.length,
      active: activeProjects.length,
      completed: completedProjects.length,
      chartData: projectsChartData,
    },
  };
}

/**
 * Parse expense amount (stored as text).
 * Handles both US format (1,234.56) and European format (1.234,56 or 3.500).
 */
function parseExpenseAmount(amount: string | null | undefined): number {
  if (!amount) return 0;
  const cleaned = amount.replace(/[€$\s]/g, "").trim();
  if (!cleaned) return 0;

  const lastComma = cleaned.lastIndexOf(",");
  const lastPeriod = cleaned.lastIndexOf(".");

  if (lastComma > lastPeriod) {
    // European: 1.234,56 (period = thousands, comma = decimal)
    const normalized = cleaned.replace(/\./g, "").replace(",", ".");
    const parsed = parseFloat(normalized);
    return isNaN(parsed) ? 0 : parsed;
  }
  if (lastPeriod >= 0) {
    const afterPeriod = cleaned.slice(lastPeriod + 1).replace(/,/g, "");
    // European thousands: 3.500 = 3500 (exactly 3 digits after period, no comma)
    if (lastComma < 0 && /^\d{3}$/.test(afterPeriod)) {
      const normalized = cleaned.replace(/\./g, "");
      const parsed = parseFloat(normalized);
      return isNaN(parsed) ? 0 : parsed;
    }
    // US: 1,234.56 (comma = thousands, period = decimal)
    const normalized = cleaned.replace(/,/g, "");
    const parsed = parseFloat(normalized);
    return isNaN(parsed) ? 0 : parsed;
  }
  const parsed = parseFloat(cleaned.replace(/,/g, ""));
  return isNaN(parsed) ? 0 : parsed;
}

export interface AssetDepreciationInfo {
  id: string;
  name: string;
  purchaseDate: Date;
  purchasePrice: number;
  residualValue: number;
  usefulLifeYears: number;
  category: string | null;
  yearlyDepreciation: number;
  currentBookValue: number;
  totalDepreciationInPeriod: number;
  schedule: Array<{ year: number; depreciation: number; bookValue: number }>;
}

export interface FinancialsStats {
  revenue: {
    total: number; // Omzet exclusief BTW (revenue excluding VAT)
    vatCollected: number; // Omzetbelasting collected (liability to tax authority)
    last30Days: number;
    change: number;
    chartData: Array<{ date: string; revenue: number }>;
  };
  expenses: {
    total: number;
    last30Days: number;
    recurring: number;
    byCategory: Array<{ category: string; amount: number; count: number }>;
    chartData: Array<{ date: string; expenses: number }>;
    depreciation: number; // Total depreciation in period (replaces direct cost for linked assets)
  };
  assets: AssetDepreciationInfo[];
  profit: {
    gross: number;
    margin: number; // percentage
    taxable: number; // gross profit for tax (simplified: revenue - expenses)
    incomeTax: number; // Dutch Box 1 (ZZP/eenmanszaak)
    net: number;
  };
  taxYear: number; // Year used for tax brackets
  estimations: {
    outstandingInvoices: number; // sent + overdue, not yet paid
    outstandingCount: number;
  };
  timeRange: string;
}

export async function getFinancialsStats(
  timeRange: string = "year",
  taxYear?: number,
  clientDateStr?: string | null
): Promise<FinancialsStats> {
  // Use client's date when provided so "last 30 days" matches user's calendar
  const now = (() => {
    if (clientDateStr && /^\d{4}-\d{2}-\d{2}$/.test(clientDateStr)) {
      const [y, m, d] = clientDateStr.split("-").map(Number);
      return new Date(y, m - 1, d, 12, 0, 0, 0);
    }
    return new Date();
  })();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    0,
    23,
    59,
    59,
    999
  );

  // Last 30 days (rolling window) - uses client date when provided
  const startOfLast30Days = new Date(now);
  startOfLast30Days.setDate(startOfLast30Days.getDate() - 30);
  startOfLast30Days.setHours(0, 0, 0, 0);
  const endOfLast30Days = new Date(now);
  endOfLast30Days.setHours(23, 59, 59, 999);
  const startOfPrev30Days = new Date(startOfLast30Days);
  startOfPrev30Days.setDate(startOfPrev30Days.getDate() - 30);
  const endOfPrev30Days = new Date(startOfLast30Days);
  endOfPrev30Days.setMilliseconds(endOfPrev30Days.getMilliseconds() - 1);

  let startDate: Date;
  let endDate: Date = now;
  let groupByMonth = false;
  const isAllTime = timeRange === "all";

  if (timeRange === "all") {
    startDate = new Date(2000, 0, 1);
    endDate = new Date(now);
    endDate.setHours(23, 59, 59, 999);
    groupByMonth = true;
  } else if (timeRange === "year") {
    const year = taxYear ?? now.getFullYear();
    startDate = new Date(year, 0, 1);
    endDate = new Date(year, 11, 31, 23, 59, 59, 999);
    groupByMonth = true;
  } else {
    const days = timeRange === "90d" ? 90 : timeRange === "30d" ? 30 : 7;
    startDate = new Date(now);
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);
    endDate = new Date(now);
    endDate.setHours(23, 59, 59, 999);
  }

  // Previous period for change (when not all-time)
  let prevStartDate: Date | null = null;
  let prevEndDate: Date | null = null;
  if (!isAllTime && timeRange === "year") {
    const year = taxYear ?? now.getFullYear();
    prevStartDate = new Date(year - 1, 0, 1);
    prevEndDate = new Date(year - 1, 11, 31, 23, 59, 59, 999);
  } else if (!isAllTime && timeRange !== "year") {
    const days = timeRange === "90d" ? 90 : timeRange === "30d" ? 30 : 7;
    prevEndDate = new Date(startDate);
    prevEndDate.setMilliseconds(prevEndDate.getMilliseconds() - 1);
    prevStartDate = new Date(prevEndDate);
    prevStartDate.setDate(prevStartDate.getDate() - days);
    prevStartDate.setHours(0, 0, 0, 0);
  }

  const usdToEurRate = await getEurToUsdRate();

  // --- Revenue (paid invoices, excluding reimbursements) ---
  const paidInvoices = await db
    .select({
      id: invoices.id,
      amount: invoices.amount,
      currency: invoices.currency,
      transactionType: invoices.transactionType,
      isKOR: invoices.isKOR,
      dueDate: invoices.dueDate,
      paidAt: invoices.paidAt,
      createdAt: invoices.createdAt,
    })
    .from(invoices)
    .where(and(eq(invoices.status, "paid"), isNull(invoices.expenseId)));

  const paidInvoiceIds = paidInvoices.map((i) => i.id);
  const lineItemsForPaid =
    paidInvoiceIds.length > 0
      ? await db
          .select({
            invoiceId: invoiceLineItems.invoiceId,
            quantity: invoiceLineItems.quantity,
            unitPrice: invoiceLineItems.unitPrice,
            taxPercentage: invoiceLineItems.taxPercentage,
          })
          .from(invoiceLineItems)
          .where(inArray(invoiceLineItems.invoiceId, paidInvoiceIds))
          .orderBy(invoiceLineItems.order)
      : [];

  const lineItemsByInvoiceId = new Map<
    string,
    Array<{
      quantity: string | number;
      unitPrice: string | number;
      taxPercentage: string | number;
    }>
  >();
  for (const item of lineItemsForPaid) {
    const list = lineItemsByInvoiceId.get(item.invoiceId) ?? [];
    list.push({
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      taxPercentage: item.taxPercentage,
    });
    lineItemsByInvoiceId.set(item.invoiceId, list);
  }

  // Helper: compare by calendar date (YYYY-MM-DD) to avoid timezone/parsing edge cases
  const toDateStr = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  let totalRevenue = 0;
  let totalVATCollected = 0;
  let revenueLast30Days = 0; // Rolling 30 days (for "all" mode subtext)
  let revenuePrev30Days = 0; // Previous 30 days (for "all" mode change)
  let revenueThisMonth = 0; // Safeguard: last30Days can never be < current month
  let revenueLastMonth = 0; // For period: current period total
  let revenuePrevPeriod = 0; // Previous period total (for change when not all-time)
  const revenueByDate: Record<string, number> = {};

  const last30StartStr = toDateStr(startOfLast30Days);
  const last30EndStr = toDateStr(endOfLast30Days);
  const prev30StartStr = toDateStr(startOfPrev30Days);
  const prev30EndStr = toDateStr(endOfPrev30Days);
  const monthStartStr = toDateStr(startOfMonth);
  const monthEndStr = toDateStr(endOfMonth);
  const periodStartStr = toDateStr(startDate);
  const periodEndStr = toDateStr(endDate);
  const prevPeriodStartStr = prevStartDate ? toDateStr(prevStartDate) : "";
  const prevPeriodEndStr = prevEndDate ? toDateStr(prevEndDate) : "";

  for (const inv of paidInvoices) {
    const amount = parseInvoiceAmount(inv.amount);
    const lineItems = lineItemsByInvoiceId.get(inv.id) ?? [];
    const isKOR = inv.isKOR ?? false;
    const vatInInvoiceCurrency = isKOR
      ? 0
      : calculateVATFromLineItems(lineItems);
    const vatInEUR = await convertToEUR(
      vatInInvoiceCurrency,
      inv.currency || "EUR",
      usdToEurRate
    );

    const isDebit = (inv.transactionType || "debit") === "debit";
    // Revenue = omzet exclusief BTW (revenue excluding VAT)
    // KOR: full amount is revenue. Non-KOR: subtract VAT (liability to tax authority)
    const revenueExclVATInvoiceCurrency = getRevenueExcludingVAT(
      amount,
      lineItems,
      isKOR
    );
    const revenueExclVATEUR = await convertToEUR(
      revenueExclVATInvoiceCurrency,
      inv.currency || "EUR",
      usdToEurRate
    );
    const value = isDebit ? revenueExclVATEUR : -revenueExclVATEUR;

    // Use paidAt for all date-based logic (revenue = when received)
    const dateForPeriod = inv.paidAt
      ? new Date(inv.paidAt)
      : inv.dueDate
        ? new Date(inv.dueDate)
        : new Date(inv.createdAt);
    const dStr = toDateStr(dateForPeriod);

    const inPeriod = dStr >= periodStartStr && dStr <= periodEndStr;
    // All Time: include all paid invoices. Other periods: filter by date.
    if (isAllTime || inPeriod) {
      totalRevenue += value;
      totalVATCollected += isDebit ? vatInEUR : -vatInEUR;
    }

    // Rolling 30 days (for "all" mode subtext and change) - use date str to avoid parsing issues
    if (dStr >= last30StartStr && dStr <= last30EndStr)
      revenueLast30Days += value;
    if (dStr >= prev30StartStr && dStr <= prev30EndStr)
      revenuePrev30Days += value;
    if (dStr >= monthStartStr && dStr <= monthEndStr) revenueThisMonth += value;

    // For change badge (All Time: last 30d vs prev 30d. Other: period vs prev period)
    if (!isAllTime) {
      if (inPeriod) revenueLastMonth += value; // period total
      if (
        prevPeriodStartStr &&
        prevPeriodEndStr &&
        dStr >= prevPeriodStartStr &&
        dStr <= prevPeriodEndStr
      )
        revenuePrevPeriod += value;
    }

    if (inPeriod) {
      const key = groupByMonth
        ? `${dateForPeriod.getFullYear()}-${String(dateForPeriod.getMonth() + 1).padStart(2, "0")}`
        : dStr;
      revenueByDate[key] = (revenueByDate[key] || 0) + value;
    }
  }

  // Safeguard: last 30 days always includes current month, so it can never be less
  if (now.getDate() <= 30 && revenueLast30Days < revenueThisMonth) {
    revenueLast30Days = revenueThisMonth;
  }
  // When timeRange is 30d, totalRevenue should also respect this (it's the same metric)
  if (
    timeRange === "30d" &&
    now.getDate() <= 30 &&
    totalRevenue < revenueThisMonth
  ) {
    totalRevenue = revenueThisMonth;
  }

  const revenueChange = isAllTime
    ? revenuePrev30Days > 0
      ? ((revenueLast30Days - revenuePrev30Days) / revenuePrev30Days) * 100
      : revenueLast30Days > 0
        ? 100
        : 0
    : revenuePrevPeriod > 0
      ? ((revenueLastMonth - revenuePrevPeriod) / revenuePrevPeriod) * 100
      : revenueLastMonth > 0
        ? 100
        : 0;

  // --- Expenses (exclude reimbursed: expense with paid invoice = pass-through, net zero) ---
  const reimbursedExpenseIds = await db
    .select({ expenseId: invoices.expenseId })
    .from(invoices)
    .where(and(eq(invoices.status, "paid"), isNotNull(invoices.expenseId)));
  const reimbursedIds = new Set(
    reimbursedExpenseIds
      .map((r) => r.expenseId)
      .filter((id): id is string => id != null)
  );

  // Expenses linked to assets: exclude from direct cost (use depreciation instead)
  const linkedExpenseIds = await getLinkedExpenseIdsFromAssets();

  const allExpenses = await db
    .select({
      id: expenses.id,
      amount: expenses.amount,
      currency: expenses.currency,
      date: expenses.date,
      category: expenses.category,
      eurEquivalent: expenses.eurEquivalent,
    })
    .from(expenses)
    .orderBy(expenses.date);

  let totalExpenses = 0;
  let expensesLast30Days = 0;
  let recurringExpenses = 0;
  const expensesByCategory: Record<string, { amount: number; count: number }> =
    {};
  const expensesByDate: Record<string, number> = {};

  for (const exp of allExpenses) {
    if (reimbursedIds.has(exp.id)) continue; // Pass-through: don't count
    if (linkedExpenseIds.has(exp.id)) continue; // Asset: use depreciation instead

    let amountInEUR: number;
    if (
      exp.eurEquivalent != null &&
      parseFloat(String(exp.eurEquivalent)) > 0
    ) {
      amountInEUR = parseFloat(String(exp.eurEquivalent));
    } else {
      const amount = parseExpenseAmount(exp.amount);
      amountInEUR = await convertToEUR(
        amount,
        exp.currency || "EUR",
        usdToEurRate
      );
    }

    const expDate = exp.date ? new Date(exp.date) : new Date();
    const inPeriod = expDate >= startDate && expDate <= endDate;
    // All Time: include all. Other periods: filter by date.
    if (isAllTime || inPeriod) totalExpenses += amountInEUR;

    // Always track last 30 days (rolling window)
    if (expDate >= startOfLast30Days && expDate <= endOfLast30Days)
      expensesLast30Days += amountInEUR;

    if (isRecurringExpenseCategory(exp.category)) {
      recurringExpenses += amountInEUR;
    }

    const cat = exp.category?.trim() || "Uncategorized";
    if (inPeriod) {
      if (!expensesByCategory[cat]) {
        expensesByCategory[cat] = { amount: 0, count: 0 };
      }
      expensesByCategory[cat].amount += amountInEUR;
      expensesByCategory[cat].count += 1;
    }

    if (expDate >= startDate && expDate <= endDate) {
      const key = groupByMonth
        ? `${expDate.getFullYear()}-${String(expDate.getMonth() + 1).padStart(2, "0")}`
        : expDate.toISOString().split("T")[0];
      expensesByDate[key] = (expensesByDate[key] || 0) + amountInEUR;
    }
  }

  // --- Assets & Depreciation ---
  const allAssets = await getAllAssets();
  let totalDepreciationInPeriod = 0;
  const assetsInfo: Array<{
    id: string;
    name: string;
    purchaseDate: Date;
    purchasePrice: number;
    residualValue: number;
    usefulLifeYears: number;
    category: string | null;
    yearlyDepreciation: number;
    currentBookValue: number;
    totalDepreciationInPeriod: number;
    schedule: Array<{ year: number; depreciation: number; bookValue: number }>;
  }> = [];

  for (const a of allAssets) {
    const purchasePrice = parseFloat(String(a.purchasePrice)) || 0;
    const residualValue = parseFloat(String(a.residualValue)) || 0;
    const usefulLifeYears = a.usefulLifeYears || 5;
    const yearlyDepreciation =
      usefulLifeYears > 0
        ? (purchasePrice - residualValue) / usefulLifeYears
        : 0;

    const purchaseDate = a.purchaseDate ? new Date(a.purchaseDate) : new Date();
    const yearsSincePurchase =
      (endDate.getTime() - purchaseDate.getTime()) /
      (365.25 * 24 * 60 * 60 * 1000);
    const yearsDepreciated = Math.min(
      Math.max(0, Math.floor(yearsSincePurchase)),
      usefulLifeYears
    );
    const totalDepreciated = yearlyDepreciation * yearsDepreciated;
    const currentBookValue = Math.max(
      residualValue,
      purchasePrice - totalDepreciated
    );

    // Depreciation schedule (per year)
    const schedule: Array<{
      year: number;
      depreciation: number;
      bookValue: number;
    }> = [];
    let runningBookValue = purchasePrice;
    const startYear = purchaseDate.getFullYear();
    for (let y = 0; y < usefulLifeYears; y++) {
      const year = startYear + y;
      const dep =
        y < usefulLifeYears - 1
          ? yearlyDepreciation
          : Math.max(0, runningBookValue - residualValue);
      runningBookValue = Math.max(residualValue, runningBookValue - dep);
      schedule.push({ year, depreciation: dep, bookValue: runningBookValue });
    }

    // Depreciation falling in current period (prorated by month)
    let depInPeriod = 0;
    if (isAllTime) {
      depInPeriod = totalDepreciated;
    } else {
      const periodStartYear = startDate.getFullYear();
      const periodEndYear = endDate.getFullYear();
      const purchaseYear = purchaseDate.getFullYear();
      for (let yr = periodStartYear; yr <= periodEndYear; yr++) {
        const yearIndex = yr - purchaseYear;
        if (yearIndex >= 0 && yearIndex < usefulLifeYears) {
          const yearStart = new Date(yr, 0, 1);
          const yearEnd = new Date(yr, 11, 31, 23, 59, 59, 999);
          const overlapStart = startDate > yearStart ? startDate : yearStart;
          const overlapEnd = endDate < yearEnd ? endDate : yearEnd;
          if (overlapStart <= overlapEnd) {
            const monthsInPeriod =
              (overlapEnd.getFullYear() - overlapStart.getFullYear()) * 12 +
              (overlapEnd.getMonth() - overlapStart.getMonth()) +
              1;
            depInPeriod +=
              (yearlyDepreciation * Math.max(0, monthsInPeriod)) / 12;
          }
        }
      }
    }

    totalDepreciationInPeriod += depInPeriod;

    assetsInfo.push({
      id: a.id,
      name: a.name,
      purchaseDate,
      purchasePrice,
      residualValue,
      usefulLifeYears,
      category: a.category,
      yearlyDepreciation,
      currentBookValue,
      totalDepreciationInPeriod: depInPeriod,
      schedule,
    });
  }

  totalExpenses += totalDepreciationInPeriod;

  if (totalDepreciationInPeriod > 0) {
    expensesByCategory["Depreciation"] = {
      amount: totalDepreciationInPeriod,
      count: assetsInfo.length,
    };
  }

  const expensesByCategoryArray = Object.entries(expensesByCategory)
    .map(([category, { amount, count }]) => ({ category, amount, count }))
    .sort((a, b) => b.amount - a.amount);

  // --- Outstanding invoices (sent, overdue) - expected revenue excl. VAT ---
  const outstandingInvoices = await db
    .select({
      id: invoices.id,
      amount: invoices.amount,
      currency: invoices.currency,
      transactionType: invoices.transactionType,
      isKOR: invoices.isKOR,
    })
    .from(invoices)
    .where(or(eq(invoices.status, "sent"), eq(invoices.status, "overdue"))!);

  const outstandingIds = outstandingInvoices.map((i) => i.id);
  const outstandingLineItems =
    outstandingIds.length > 0
      ? await db
          .select({
            invoiceId: invoiceLineItems.invoiceId,
            quantity: invoiceLineItems.quantity,
            unitPrice: invoiceLineItems.unitPrice,
            taxPercentage: invoiceLineItems.taxPercentage,
          })
          .from(invoiceLineItems)
          .where(inArray(invoiceLineItems.invoiceId, outstandingIds))
          .orderBy(invoiceLineItems.order)
      : [];

  const outstandingLineItemsByInvoice = new Map<
    string,
    Array<{
      quantity: string | number;
      unitPrice: string | number;
      taxPercentage: string | number;
    }>
  >();
  for (const item of outstandingLineItems) {
    const list = outstandingLineItemsByInvoice.get(item.invoiceId) ?? [];
    list.push({
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      taxPercentage: item.taxPercentage,
    });
    outstandingLineItemsByInvoice.set(item.invoiceId, list);
  }

  let outstandingTotal = 0;
  for (const inv of outstandingInvoices) {
    const amount = parseInvoiceAmount(inv.amount);
    const amountInEUR = await convertToEUR(
      amount,
      inv.currency || "EUR",
      usdToEurRate
    );
    const lineItems = outstandingLineItemsByInvoice.get(inv.id) ?? [];
    const revenueExclVAT = getRevenueExcludingVAT(
      amountInEUR,
      lineItems,
      inv.isKOR ?? false
    );
    const isDebit = (inv.transactionType || "debit") === "debit";
    outstandingTotal += isDebit ? revenueExclVAT : -revenueExclVAT;
  }

  // --- Profit & tax (ZZP/eenmanszaak: Box 1 income tax) ---
  const grossProfit = totalRevenue - totalExpenses;
  const margin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
  const taxableProfit = Math.max(0, grossProfit);
  const yearForTax = taxYear ?? now.getFullYear();
  const incomeTax = calculateDutchIncomeTax(taxableProfit, yearForTax);
  const netProfit = grossProfit - incomeTax;

  // --- Chart data ---
  const revenueChartData: Array<{ date: string; revenue: number }> = [];
  const expensesChartData: Array<{ date: string; expenses: number }> = [];

  if (groupByMonth) {
    const startMonth = isAllTime
      ? new Date(now.getFullYear(), now.getMonth() - 11, 1)
      : new Date(now.getFullYear(), 0, 1);
    for (let i = 0; i < 12; i++) {
      const d = new Date(
        startMonth.getFullYear(),
        startMonth.getMonth() + i,
        1
      );
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
      });
      revenueChartData.push({
        date: label,
        revenue: revenueByDate[key] || 0,
      });
      expensesChartData.push({
        date: label,
        expenses: expensesByDate[key] || 0,
      });
    }
  } else {
    const days = timeRange === "90d" ? 90 : timeRange === "30d" ? 30 : 7;
    for (let i = 0; i <= days; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      const key = d.toISOString().split("T")[0];
      const label = `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1).toString().padStart(2, "0")}/${d.getFullYear()}`;
      revenueChartData.push({
        date: label,
        revenue: revenueByDate[key] || 0,
      });
      expensesChartData.push({
        date: label,
        expenses: expensesByDate[key] || 0,
      });
    }
  }

  return {
    revenue: {
      total: totalRevenue,
      vatCollected: totalVATCollected,
      last30Days: revenueLast30Days,
      change: revenueChange,
      chartData: revenueChartData,
    },
    expenses: {
      total: totalExpenses,
      last30Days: expensesLast30Days,
      recurring: recurringExpenses,
      byCategory: expensesByCategoryArray,
      chartData: expensesChartData,
      depreciation: totalDepreciationInPeriod,
    },
    assets: assetsInfo,
    profit: {
      gross: grossProfit,
      margin,
      taxable: taxableProfit,
      incomeTax,
      net: netProfit,
    },
    taxYear: yearForTax,
    estimations: {
      outstandingInvoices: outstandingTotal,
      outstandingCount: outstandingInvoices.length,
    },
    timeRange,
  };
}

export async function getAllInvoices() {
  // CRITICAL: Exclude pdfStoragePath from list queries to avoid transferring metadata
  // We'll use pdfFileName to check if a PDF exists, and only fetch pdfStoragePath when downloading
  const results = await db
    .select({
      invoice: {
        id: invoices.id,
        invoiceNumber: invoices.invoiceNumber,
        projectId: invoices.projectId,
        companyId: invoices.companyId,
        expenseId: invoices.expenseId,
        amount: invoices.amount,
        currency: invoices.currency,
        status: invoices.status,
        type: invoices.type,
        transactionType: invoices.transactionType,
        vatIncluded: invoices.vatIncluded,
        isKOR: invoices.isKOR,
        description: invoices.description,
        dueDate: invoices.dueDate,
        paidAt: invoices.paidAt,
        pdfStoragePath: sql<string | null>`NULL`.as("pdfStoragePath"), // Explicitly set to null to avoid transferring data
        pdfFileName: invoices.pdfFileName,
        pdfSizeBytes: invoices.pdfSizeBytes,
        createdAt: invoices.createdAt,
        updatedAt: invoices.updatedAt,
      },
      project: {
        id: projects.id,
        title: projects.title,
      },
      company: {
        id: companies.id,
        name: companies.name,
      },
    })
    .from(invoices)
    .leftJoin(projects, eq(invoices.projectId, projects.id))
    .innerJoin(companies, eq(invoices.companyId, companies.id))
    // Sort by invoice number (INV-YYYY-NNNN) for stable, expected ordering
    .orderBy(desc(invoices.invoiceNumber), desc(invoices.createdAt));

  // Fetch all line items for all invoices in one query
  const invoiceIds = results.map((r) => r.invoice.id);
  const allLineItems =
    invoiceIds.length > 0
      ? await db
          .select()
          .from(invoiceLineItems)
          .where(inArray(invoiceLineItems.invoiceId, invoiceIds))
          .orderBy(invoiceLineItems.order)
      : [];

  // Convert decimal fields to strings for the form
  // Quantity should always be an integer (whole number)
  const formattedAllLineItems = allLineItems.map((item) => ({
    ...item,
    quantity: item.quantity
      ? Math.round(parseFloat(item.quantity.toString())).toString()
      : "1",
    unitPrice: item.unitPrice?.toString() || "0",
    taxPercentage: item.taxPercentage?.toString() || "0",
  }));

  // Group line items by invoice ID
  const lineItemsByInvoice = new Map<string, typeof formattedAllLineItems>();
  formattedAllLineItems.forEach((item) => {
    if (!lineItemsByInvoice.has(item.invoiceId)) {
      lineItemsByInvoice.set(item.invoiceId, []);
    }
    lineItemsByInvoice.get(item.invoiceId)!.push(item);
  });

  // Attach line items to each invoice, creating legacy line items if needed
  return results.map((result) => {
    const items = lineItemsByInvoice.get(result.invoice.id) || [];

    // If no line items exist but invoice has legacy data, create a virtual line item
    if (items.length === 0 && result.invoice.amount) {
      let amountValue = parseFloat(result.invoice.amount) || 0;
      const isCredit = result.invoice.transactionType === "credit";
      const vatIncluded = result.invoice.vatIncluded ?? true;
      const isKOR = result.invoice.isKOR || false;
      const isReimbursement = result.invoice.expenseId !== null;

      // For credit invoices, make amount negative
      if (isCredit) {
        amountValue = -Math.abs(amountValue);
      }

      const quantity = "1";
      let unitPrice: string;
      const taxPercentage =
        isKOR || isReimbursement ? "0" : VAT_PERCENTAGE.toString();

      if (vatIncluded && !isKOR) {
        // Calculate unit price without VAT
        const subtotal = amountValue / (1 + VAT_PERCENTAGE / 100);
        unitPrice = subtotal.toFixed(2);
      } else {
        // No VAT or KOR
        unitPrice = amountValue.toFixed(2);
      }

      // Use description if available, otherwise use a fallback
      const description =
        result.invoice.description ||
        result.project?.title ||
        `Invoice ${result.invoice.invoiceNumber}`;

      // Return virtual line item (not saved to DB yet, will be saved when invoice is updated)
      return {
        ...result,
        lineItems: [
          {
            id: `legacy-${result.invoice.id}`,
            invoiceId: result.invoice.id,
            description,
            quantity,
            unitPrice,
            taxPercentage,
            order: 0,
            createdAt: result.invoice.createdAt,
            updatedAt: result.invoice.updatedAt,
          },
        ],
      };
    }

    return {
      ...result,
      lineItems: items,
    };
  });
}

// Paginated version of getAllInvoices
export async function getAllInvoicesPaginated(options?: {
  limit?: number;
  offset?: number;
  status?: string;
  type?: string;
  search?: string;
}) {
  // CRITICAL: Exclude pdfStoragePath from list queries to avoid transferring metadata
  let query = db
    .select({
      invoice: {
        id: invoices.id,
        invoiceNumber: invoices.invoiceNumber,
        projectId: invoices.projectId,
        companyId: invoices.companyId,
        expenseId: invoices.expenseId,
        amount: invoices.amount,
        currency: invoices.currency,
        status: invoices.status,
        type: invoices.type,
        transactionType: invoices.transactionType,
        vatIncluded: invoices.vatIncluded,
        isKOR: invoices.isKOR,
        description: invoices.description,
        invoiceDate: invoices.invoiceDate,
        dueDate: invoices.dueDate,
        paidAt: invoices.paidAt,
        pdfStoragePath: sql<string | null>`NULL`.as("pdfStoragePath"), // Explicitly set to null to avoid transferring data
        pdfFileName: invoices.pdfFileName,
        pdfSizeBytes: invoices.pdfSizeBytes,
        createdAt: invoices.createdAt,
        updatedAt: invoices.updatedAt,
      },
      project: {
        id: projects.id,
        title: projects.title,
      },
      company: {
        id: companies.id,
        name: companies.name,
        email: companies.email,
      },
    })
    .from(invoices)
    .leftJoin(projects, eq(invoices.projectId, projects.id))
    .innerJoin(companies, eq(invoices.companyId, companies.id));

  // Apply filters
  const conditions = [];
  if (options?.status) {
    conditions.push(eq(invoices.status, options.status));
  }
  if (options?.type) {
    conditions.push(eq(invoices.type, options.type));
  }
  if (options?.search) {
    const searchTerm = `%${options.search.toLowerCase()}%`;
    conditions.push(
      or(
        like(sql`LOWER(${invoices.invoiceNumber})`, searchTerm),
        like(sql`LOWER(${companies.name})`, searchTerm),
        like(sql`LOWER(${projects.title})`, searchTerm),
        like(sql`LOWER(${invoices.description})`, searchTerm)
      )!
    );
  }

  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as typeof query;
  }

  // Sort by invoice number (INV-YYYY-NNNN) for stable, expected ordering
  query = query.orderBy(
    desc(invoices.invoiceNumber),
    desc(invoices.createdAt)
  ) as typeof query;

  if (options?.limit) {
    query = query.limit(options.limit) as typeof query;
  }
  if (options?.offset) {
    query = query.offset(options.offset) as typeof query;
  }

  const results = await query;

  // Fetch all line items for the paginated invoices
  const invoiceIds = results.map((r) => r.invoice.id);
  const allLineItems =
    invoiceIds.length > 0
      ? await db
          .select()
          .from(invoiceLineItems)
          .where(inArray(invoiceLineItems.invoiceId, invoiceIds))
          .orderBy(invoiceLineItems.order)
      : [];

  // Convert decimal fields to strings for the form
  const formattedAllLineItems = allLineItems.map((item) => ({
    ...item,
    quantity: item.quantity
      ? Math.round(parseFloat(item.quantity.toString())).toString()
      : "1",
    unitPrice: item.unitPrice?.toString() || "0",
    taxPercentage: item.taxPercentage?.toString() || "0",
  }));

  // Group line items by invoice ID
  const lineItemsByInvoice = new Map<string, typeof formattedAllLineItems>();
  formattedAllLineItems.forEach((item) => {
    if (!lineItemsByInvoice.has(item.invoiceId)) {
      lineItemsByInvoice.set(item.invoiceId, []);
    }
    lineItemsByInvoice.get(item.invoiceId)!.push(item);
  });

  // Attach line items to each invoice, creating legacy line items if needed
  return results.map((result) => {
    const items = lineItemsByInvoice.get(result.invoice.id) || [];

    // If no line items exist but invoice has legacy data, create a virtual line item
    if (items.length === 0 && result.invoice.amount) {
      let amountValue = parseFloat(result.invoice.amount) || 0;
      const isCredit = result.invoice.transactionType === "credit";
      const vatIncluded = result.invoice.vatIncluded ?? true;
      const isKOR = result.invoice.isKOR || false;
      const isReimbursement = result.invoice.expenseId !== null;

      if (isCredit) {
        amountValue = -Math.abs(amountValue);
      }

      const quantity = "1";
      let unitPrice: string;
      const taxPercentage =
        isKOR || isReimbursement ? "0" : VAT_PERCENTAGE.toString();

      if (vatIncluded && !isKOR) {
        const subtotal = amountValue / (1 + VAT_PERCENTAGE / 100);
        unitPrice = subtotal.toFixed(2);
      } else {
        unitPrice = amountValue.toFixed(2);
      }

      const description =
        result.invoice.description ||
        result.project?.title ||
        `Invoice ${result.invoice.invoiceNumber}`;

      return {
        ...result,
        lineItems: [
          {
            id: `legacy-${result.invoice.id}`,
            invoiceId: result.invoice.id,
            description,
            quantity,
            unitPrice,
            taxPercentage,
            order: 0,
            createdAt: result.invoice.createdAt,
            updatedAt: result.invoice.updatedAt,
          },
        ],
      };
    }

    return {
      ...result,
      lineItems: items,
    };
  });
}

// Get total count of invoices with optional filters
export async function getAllInvoicesCount(filters?: {
  status?: string;
  type?: string;
  search?: string;
}) {
  // If search is needed, we need joins, so build query with joins upfront
  let query = filters?.search
    ? db
        .select({ count: sql<number>`count(*)` })
        .from(invoices)
        .leftJoin(projects, eq(invoices.projectId, projects.id))
        .innerJoin(companies, eq(invoices.companyId, companies.id))
    : db.select({ count: sql<number>`count(*)` }).from(invoices);

  // Apply same filters as getAllInvoicesPaginated
  const conditions = [];
  if (filters?.status) {
    conditions.push(eq(invoices.status, filters.status));
  }
  if (filters?.type) {
    conditions.push(eq(invoices.type, filters.type));
  }
  if (filters?.search) {
    const searchTerm = `%${filters.search.toLowerCase()}%`;
    conditions.push(
      or(
        like(sql`LOWER(${invoices.invoiceNumber})`, searchTerm),
        like(sql`LOWER(${companies.name})`, searchTerm),
        like(sql`LOWER(${projects.title})`, searchTerm),
        like(sql`LOWER(${invoices.description})`, searchTerm)
      )!
    );
  }
  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as typeof query;
  }

  const result = await query;
  return Number(result[0]?.count || 0);
}

export async function getInvoicesByProjectId(projectId: string) {
  return db
    .select({
      id: invoices.id,
      invoiceNumber: invoices.invoiceNumber,
      amount: invoices.amount,
      currency: invoices.currency,
      status: invoices.status,
      expenseId: invoices.expenseId,
      transactionType: invoices.transactionType,
      invoiceDate: invoices.invoiceDate,
      dueDate: invoices.dueDate,
      paidAt: invoices.paidAt,
    })
    .from(invoices)
    .where(eq(invoices.projectId, projectId))
    .orderBy(desc(invoices.invoiceDate), desc(invoices.invoiceNumber));
}

export async function getContractsByProjectId(projectId: string) {
  const fromJunction = await db
    .select({
      id: contracts.id,
      name: contracts.name,
      signed: contracts.signed,
      signedAt: contracts.signedAt,
      createdAt: contracts.createdAt,
    })
    .from(contracts)
    .innerJoin(contractProjects, eq(contractProjects.contractId, contracts.id))
    .where(
      and(
        eq(contractProjects.projectId, projectId),
        eq(contracts.type, "contract")
      )
    )
    .orderBy(desc(contracts.createdAt));

  const fromLegacy = await db
    .select({
      id: contracts.id,
      name: contracts.name,
      signed: contracts.signed,
      signedAt: contracts.signedAt,
      createdAt: contracts.createdAt,
    })
    .from(contracts)
    .where(
      and(eq(contracts.projectId, projectId), eq(contracts.type, "contract"))
    )
    .orderBy(desc(contracts.createdAt));

  const seen = new Set<string>();
  const merged = [...fromJunction, ...fromLegacy].filter((c) => {
    if (seen.has(c.id)) return false;
    seen.add(c.id);
    return true;
  });
  merged.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  return merged;
}

export async function getInvoiceById(invoiceId: string) {
  const result = await db
    .select({
      invoice: {
        id: invoices.id,
        invoiceNumber: invoices.invoiceNumber,
        projectId: invoices.projectId,
        companyId: invoices.companyId,
        expenseId: invoices.expenseId,
        amount: invoices.amount,
        currency: invoices.currency,
        status: invoices.status,
        type: invoices.type,
        transactionType: invoices.transactionType,
        vatIncluded: invoices.vatIncluded,
        isKOR: invoices.isKOR,
        description: invoices.description,
        invoiceDate: invoices.invoiceDate,
        dueDate: invoices.dueDate,
        paidAt: invoices.paidAt,
        pdfStoragePath: invoices.pdfStoragePath,
        pdfFileName: invoices.pdfFileName,
        pdfSizeBytes: invoices.pdfSizeBytes,
        createdAt: invoices.createdAt,
        updatedAt: invoices.updatedAt,
      },
      project: {
        id: projects.id,
        title: projects.title,
        subtotal: projects.subtotal,
        currency: projects.currency,
      },
      company: {
        id: companies.id,
        name: companies.name,
        address: companies.address,
        kvkNumber: companies.kvkNumber,
        btwNumber: companies.btwNumber,
        email: companies.email,
        telephone: companies.telephone,
      },
    })
    .from(invoices)
    .leftJoin(projects, eq(invoices.projectId, projects.id))
    .innerJoin(companies, eq(invoices.companyId, companies.id))
    .where(eq(invoices.id, invoiceId))
    .limit(1);

  if (!result[0]) {
    return null;
  }

  // Fetch line items
  const items = await db
    .select()
    .from(invoiceLineItems)
    .where(eq(invoiceLineItems.invoiceId, invoiceId))
    .orderBy(invoiceLineItems.order);

  // Convert decimal fields to strings for the form
  // Quantity should always be an integer (whole number)
  const formattedItems = items.map((item) => ({
    ...item,
    quantity: item.quantity
      ? Math.round(parseFloat(item.quantity.toString())).toString()
      : "1",
    unitPrice: item.unitPrice?.toString() || "0",
    taxPercentage: item.taxPercentage?.toString() || "0",
  }));

  // If no line items exist but invoice has legacy data, create a virtual line item
  if (formattedItems.length === 0 && result[0].invoice.amount) {
    let amountValue = parseFloat(result[0].invoice.amount) || 0;
    const isCredit = result[0].invoice.transactionType === "credit";
    const vatIncluded = result[0].invoice.vatIncluded ?? true;
    const isKOR = result[0].invoice.isKOR || false;
    const isReimbursement = result[0].invoice.expenseId !== null;

    // For credit invoices, make amount negative
    if (isCredit) {
      amountValue = -Math.abs(amountValue);
    }

    const quantity = "1";
    let unitPrice: string;
    const taxPercentage =
      isKOR || isReimbursement ? "0" : VAT_PERCENTAGE.toString();

    if (vatIncluded && !isKOR) {
      // Calculate unit price without VAT
      const subtotal = amountValue / (1 + VAT_PERCENTAGE / 100);
      unitPrice = subtotal.toFixed(2);
    } else {
      // No VAT or KOR
      unitPrice = amountValue.toFixed(2);
    }

    // Use description if available, otherwise use a fallback
    const description =
      result[0].invoice.description ||
      result[0].project?.title ||
      `Invoice ${result[0].invoice.invoiceNumber}`;

    // Return virtual line item (not saved to DB yet, will be saved when invoice is updated)
    return {
      ...result[0],
      lineItems: [
        {
          id: `legacy-${result[0].invoice.id}`,
          invoiceId: result[0].invoice.id,
          description,
          quantity,
          unitPrice,
          taxPercentage,
          order: 0,
          createdAt: result[0].invoice.createdAt,
          updatedAt: result[0].invoice.updatedAt,
        },
      ],
    };
  }

  return {
    ...result[0],
    lineItems: formattedItems,
  };
}

export async function getNextInvoiceNumber(): Promise<string> {
  const currentYear = new Date().getFullYear();
  const pattern = `INV-${currentYear}-%`;

  // Get all invoice numbers for the current year
  const currentYearInvoices = await db
    .select({ invoiceNumber: invoices.invoiceNumber })
    .from(invoices)
    .where(sql`${invoices.invoiceNumber} LIKE ${pattern}`);

  if (currentYearInvoices.length === 0) {
    // First invoice for this year
    return `INV-${currentYear}-0001`;
  }

  // Extract numbers and find the maximum
  let maxNum = 0;
  for (const invoice of currentYearInvoices) {
    const match = invoice.invoiceNumber.match(/INV-(\d{4})-(\d+)/);
    if (match && parseInt(match[1]) === currentYear) {
      const num = parseInt(match[2]);
      if (num > maxNum) {
        maxNum = num;
      }
    }
  }

  // Increment the maximum number
  const nextNum = maxNum + 1;
  return `INV-${currentYear}-${String(nextNum).padStart(4, "0")}`;
}

export async function createInvoice(data: {
  invoiceNumber: string;
  projectId?: string | null;
  companyId: string;
  contactId?: string | null;
  expenseId?: string | null;
  amount: string;
  currency?: string;
  status?: string;
  type?: string;
  transactionType?: string;
  vatIncluded?: boolean | null;
  isKOR?: boolean;
  description?: string | null;
  invoiceDate?: Date;
  dueDate?: Date | null;
  pdfStoragePath?: string | null; // Path in Supabase Storage
  pdfFileName?: string | null;
  pdfSizeBytes?: number | null;
  lineItems?: Array<{
    description: string;
    quantity: string;
    unitPrice: string;
    taxPercentage: string;
    order: number;
  }>;
}) {
  const status = data.status || "draft";
  const paidAt = status === "paid" ? new Date() : null;

  const [invoice] = await db
    .insert(invoices)
    .values({
      invoiceNumber: data.invoiceNumber,
      projectId: data.projectId || null,
      companyId: data.companyId,
      contactId: data.contactId || null,
      expenseId: data.expenseId ?? null,
      amount: data.amount,
      currency: data.currency || "EUR",
      status,
      type: data.type || "manual",
      transactionType: data.transactionType || "debit",
      vatIncluded: data.vatIncluded !== undefined ? data.vatIncluded : null,
      isKOR: data.isKOR || false,
      description: data.description || null,
      invoiceDate: data.invoiceDate ?? new Date(),
      dueDate: data.dueDate || null,
      paidAt,
      pdfStoragePath: data.pdfStoragePath || null,
      pdfFileName: data.pdfFileName || null,
      pdfSizeBytes: data.pdfSizeBytes || null,
    })
    .returning();

  // Create line items if provided
  if (data.lineItems && data.lineItems.length > 0) {
    await db.insert(invoiceLineItems).values(
      data.lineItems.map((item) => ({
        invoiceId: invoice.id,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        taxPercentage: item.taxPercentage,
        order: item.order,
      }))
    );
  }

  return invoice;
}

export async function updateInvoice(
  invoiceId: string,
  data: Partial<{
    companyId: string;
    contactId: string | null;
    projectId: string | null;
    status: string;
    expenseId: string | null;
    amount: string;
    currency: string;
    transactionType: string;
    vatIncluded: boolean | null;
    isKOR: boolean;
    description: string | null;
    invoiceDate: Date;
    dueDate: Date | null;
    paidAt: Date | null;
    pdfStoragePath: string | null; // Path in Supabase Storage
    pdfFileName: string | null;
    pdfSizeBytes: number | null;
    sentAt: Date | null;
    sentToEmail: string | null;
    lineItems?: Array<{
      id?: string;
      description: string;
      quantity: string;
      unitPrice: string;
      taxPercentage: string;
      order: number;
    }>;
  }>
) {
  const { lineItems, ...invoiceData } = data;

  // When status changes to "paid", set paidAt if not already provided
  if (data.status === "paid" && data.paidAt === undefined) {
    const [current] = await db
      .select({ status: invoices.status, paidAt: invoices.paidAt })
      .from(invoices)
      .where(eq(invoices.id, invoiceId))
      .limit(1);
    if (current && (current.status !== "paid" || current.paidAt == null)) {
      (invoiceData as Record<string, unknown>).paidAt = new Date();
    }
  }

  // When status changes away from "paid", clear paidAt
  if (
    data.status &&
    data.status !== "paid" &&
    invoiceData.paidAt === undefined
  ) {
    const [current] = await db
      .select({ status: invoices.status })
      .from(invoices)
      .where(eq(invoices.id, invoiceId))
      .limit(1);
    if (current?.status === "paid") {
      (invoiceData as Record<string, unknown>).paidAt = null;
    }
  }

  // Always update updatedAt to invalidate download cache (ETag is based on updatedAt)
  const [invoice] = await db
    .update(invoices)
    .set({
      ...invoiceData,
      updatedAt: new Date(),
    })
    .where(eq(invoices.id, invoiceId))
    .returning();

  // Update line items if provided
  if (lineItems !== undefined) {
    // Delete existing line items
    await db
      .delete(invoiceLineItems)
      .where(eq(invoiceLineItems.invoiceId, invoiceId));

    // Insert new line items
    if (lineItems.length > 0) {
      await db.insert(invoiceLineItems).values(
        lineItems.map((item) => ({
          invoiceId: invoice.id,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          taxPercentage: item.taxPercentage,
          order: item.order,
        }))
      );
    }
  }

  return invoice;
}

export async function deleteInvoice(invoiceId: string) {
  // Get the invoice first to check if it has a Storage file
  const invoice = await db
    .select({ pdfStoragePath: invoices.pdfStoragePath })
    .from(invoices)
    .where(eq(invoices.id, invoiceId))
    .limit(1);

  // Delete the invoice (this will cascade delete line items)
  await db.delete(invoices).where(eq(invoices.id, invoiceId));

  // Delete the PDF from Storage if it exists
  if (invoice[0]?.pdfStoragePath) {
    try {
      const { deleteInvoicePDF } = await import("@/lib/utils/invoice-storage");
      await deleteInvoicePDF(invoice[0].pdfStoragePath);
    } catch (error) {
      // Log error but don't fail the deletion if Storage deletion fails
      console.error("Error deleting invoice PDF from Storage:", error);
    }
  }
}

export async function markOverdueInvoices(): Promise<
  Array<{ invoiceNumber: string; companyName: string; dueDate: Date }>
> {
  const result = await db
    .update(invoices)
    .set({ status: "overdue", updatedAt: new Date() })
    .where(
      and(
        eq(invoices.status, "sent"),
        sql`${invoices.dueDate} IS NOT NULL AND ${invoices.dueDate}::date < CURRENT_DATE`
      )
    )
    .returning({
      invoiceNumber: invoices.invoiceNumber,
      companyId: invoices.companyId,
      dueDate: invoices.dueDate,
    });

  if (result.length === 0) return [];

  const orgIds = [...new Set(result.map((r) => r.companyId))];
  const orgs = await db
    .select({ id: companies.id, name: companies.name })
    .from(companies)
    .where(inArray(companies.id, orgIds));
  const orgMap = new Map(orgs.map((o) => [o.id, o.name]));

  return result.map((r) => ({
    invoiceNumber: r.invoiceNumber,
    companyName: orgMap.get(r.companyId) ?? "Unknown",
    dueDate: r.dueDate!,
  }));
}

export async function invalidateAllInvoiceCaches() {
  // Update all invoices' updatedAt to force cache invalidation
  // This changes the ETag for all invoices, invalidating browser/CDN cache
  await db
    .update(invoices)
    .set({ updatedAt: new Date() })
    .returning({ id: invoices.id });
}

// Contract queries
export async function getAllContracts() {
  // Get all contracts with their company and first project (for backward compatibility)
  // Note: fileStoragePath is just a path string, not the file data, so it's safe to include
  const contractsList = await db
    .select({
      contract: {
        id: contracts.id,
        companyId: contracts.companyId,
        name: contracts.name,
        type: contracts.type,
        fileStoragePath: contracts.fileStoragePath,
        fileName: contracts.fileName,
        fileSizeBytes: contracts.fileSizeBytes,
        requiresPortalSignature: contracts.requiresPortalSignature,
        signed: contracts.signed,
        signedAt: contracts.signedAt,
        signature: contracts.signature,
        signedBy: contracts.signedBy,
        createdAt: contracts.createdAt,
      },
      company: {
        id: companies.id,
        name: companies.name,
      },
      project: {
        id: projects.id,
        title: projects.title,
      },
      signedByUser: {
        id: users.id,
        name: users.name,
        email: users.email,
      },
    })
    .from(contracts)
    .innerJoin(companies, eq(contracts.companyId, companies.id))
    .leftJoin(projects, eq(contracts.projectId, projects.id))
    .leftJoin(users, eq(contracts.signedBy, users.id))
    .where(eq(contracts.type, "contract"))
    .orderBy(desc(contracts.createdAt));

  // Get all project associations from junction table
  const allContractProjectIds = contractsList.map((c) => c.contract.id);
  const projectAssociations =
    allContractProjectIds.length > 0
      ? await db
          .select({
            contractId: contractProjects.contractId,
            project: {
              id: projects.id,
              title: projects.title,
            },
            company: {
              id: companies.id,
              name: companies.name,
            },
          })
          .from(contractProjects)
          .innerJoin(projects, eq(contractProjects.projectId, projects.id))
          .innerJoin(companies, eq(projects.companyId, companies.id))
          .where(inArray(contractProjects.contractId, allContractProjectIds))
      : [];

  // Group projects by contract ID
  const projectsByContract = new Map<string, typeof projectAssociations>();
  projectAssociations.forEach((assoc) => {
    if (!projectsByContract.has(assoc.contractId)) {
      projectsByContract.set(assoc.contractId, []);
    }
    projectsByContract.get(assoc.contractId)!.push(assoc);
  });

  // Attach projects to each contract
  return contractsList.map((contract) => {
    const associatedProjects =
      projectsByContract.get(contract.contract.id) || [];
    // If no projects from junction table but has legacy projectId, use that
    if (associatedProjects.length === 0 && contract.project) {
      return {
        ...contract,
        projects: [contract.project],
        companies: [contract.company], // Always has company now
      };
    }
    // Always include the contract's company, plus any from projects
    const allOrganizations = new Map();
    allOrganizations.set(contract.company.id, contract.company);
    associatedProjects.forEach((a) => {
      allOrganizations.set(a.company.id, a.company);
    });
    return {
      ...contract,
      projects: associatedProjects.map((a) => a.project),
      companies: Array.from(allOrganizations.values()),
    };
  });
}

export async function getContractById(contractId: string) {
  const result = await db
    .select({
      contract: {
        id: contracts.id,
        companyId: contracts.companyId,
        name: contracts.name,
        type: contracts.type,
        fileStoragePath: contracts.fileStoragePath,
        fileName: contracts.fileName,
        fileSizeBytes: contracts.fileSizeBytes,
        requiresPortalSignature: contracts.requiresPortalSignature,
        signed: contracts.signed,
        signedAt: contracts.signedAt,
        signature: contracts.signature,
        signedBy: contracts.signedBy,
        createdAt: contracts.createdAt,
      },
      company: {
        id: companies.id,
        name: companies.name,
      },
      project: {
        id: projects.id,
        title: projects.title,
      },
      signedByUser: {
        id: users.id,
        name: users.name,
        email: users.email,
      },
    })
    .from(contracts)
    .innerJoin(companies, eq(contracts.companyId, companies.id))
    .leftJoin(projects, eq(contracts.projectId, projects.id))
    .leftJoin(users, eq(contracts.signedBy, users.id))
    .where(and(eq(contracts.id, contractId), eq(contracts.type, "contract")))
    .limit(1);

  if (!result[0]) return null;

  // Get all projects from junction table
  const projectAssociations = await db
    .select({
      project: {
        id: projects.id,
        title: projects.title,
      },
      company: {
        id: companies.id,
        name: companies.name,
      },
    })
    .from(contractProjects)
    .innerJoin(projects, eq(contractProjects.projectId, projects.id))
    .innerJoin(companies, eq(projects.companyId, companies.id))
    .where(eq(contractProjects.contractId, contractId));

  // Always include the contract's company, plus any from projects
  const allOrganizations = new Map();
  allOrganizations.set(result[0].company.id, result[0].company);
  projectAssociations.forEach((a) => {
    allOrganizations.set(a.company.id, a.company);
  });

  // If no projects from junction table but has legacy projectId, use that
  if (projectAssociations.length === 0 && result[0].project) {
    return {
      ...result[0],
      projects: [result[0].project],
      companies: Array.from(allOrganizations.values()),
    };
  }

  return {
    ...result[0],
    projects: projectAssociations.map((a) => a.project),
    companies: Array.from(allOrganizations.values()),
  };
}

// Paginated version of getAllContracts
export async function getAllContractsPaginated(options?: {
  limit?: number;
  offset?: number;
  signed?: string; // "signed" or "pending"
  search?: string;
}) {
  let query = db
    .select({
      contract: {
        id: contracts.id,
        companyId: contracts.companyId,
        name: contracts.name,
        type: contracts.type,
        fileStoragePath: contracts.fileStoragePath,
        fileName: contracts.fileName,
        fileSizeBytes: contracts.fileSizeBytes,
        requiresPortalSignature: contracts.requiresPortalSignature,
        signed: contracts.signed,
        signedAt: contracts.signedAt,
        signature: contracts.signature,
        signedBy: contracts.signedBy,
        createdAt: contracts.createdAt,
      },
      company: {
        id: companies.id,
        name: companies.name,
      },
      project: {
        id: projects.id,
        title: projects.title,
      },
      signedByUser: {
        id: users.id,
        name: users.name,
        email: users.email,
      },
    })
    .from(contracts)
    .innerJoin(companies, eq(contracts.companyId, companies.id))
    .leftJoin(projects, eq(contracts.projectId, projects.id))
    .leftJoin(users, eq(contracts.signedBy, users.id));

  // Apply filters
  const conditions = [eq(contracts.type, "contract")];
  if (options?.signed === "signed") {
    conditions.push(eq(contracts.signed, true));
  } else if (options?.signed === "pending") {
    conditions.push(eq(contracts.signed, false));
  }
  if (options?.search) {
    const searchTerm = `%${options.search.toLowerCase()}%`;
    conditions.push(
      or(
        like(sql`LOWER(${contracts.name})`, searchTerm),
        like(sql`LOWER(${companies.name})`, searchTerm),
        like(sql`LOWER(${projects.title})`, searchTerm)
      )!
    );
  }

  query = query.where(and(...conditions)) as typeof query;

  query = query.orderBy(desc(contracts.createdAt)) as typeof query;

  if (options?.limit) {
    query = query.limit(options.limit) as typeof query;
  }
  if (options?.offset) {
    query = query.offset(options.offset) as typeof query;
  }

  const contractsList = await query;

  // Get all project associations from junction table
  const allContractProjectIds = contractsList.map((c) => c.contract.id);
  const projectAssociations =
    allContractProjectIds.length > 0
      ? await db
          .select({
            contractId: contractProjects.contractId,
            project: {
              id: projects.id,
              title: projects.title,
            },
            company: {
              id: companies.id,
              name: companies.name,
            },
          })
          .from(contractProjects)
          .innerJoin(projects, eq(contractProjects.projectId, projects.id))
          .innerJoin(companies, eq(projects.companyId, companies.id))
          .where(inArray(contractProjects.contractId, allContractProjectIds))
      : [];

  // Group projects by contract ID
  const projectsByContract = new Map<string, typeof projectAssociations>();
  projectAssociations.forEach((assoc) => {
    if (!projectsByContract.has(assoc.contractId)) {
      projectsByContract.set(assoc.contractId, []);
    }
    projectsByContract.get(assoc.contractId)!.push(assoc);
  });

  // Attach projects to each contract
  return contractsList.map((contract) => {
    const associatedProjects =
      projectsByContract.get(contract.contract.id) || [];
    // If no projects from junction table but has legacy projectId, use that
    if (associatedProjects.length === 0 && contract.project) {
      return {
        ...contract,
        projects: [contract.project],
        companies: [contract.company],
      };
    }

    // Get unique companies from projects
    const allOrganizations = new Map<string, typeof contract.company>();
    allOrganizations.set(contract.company.id, contract.company);
    associatedProjects.forEach((assoc) => {
      if (!allOrganizations.has(assoc.company.id)) {
        allOrganizations.set(assoc.company.id, assoc.company);
      }
    });

    return {
      ...contract,
      projects: associatedProjects.map((a) => a.project),
      companies: Array.from(allOrganizations.values()),
    };
  });
}

// Get total count of contracts with optional filters
export async function getAllContractsCount(filters?: {
  signed?: string; // "signed" or "pending"
  search?: string;
}) {
  // If search is needed, we need joins, so build query with joins upfront
  let query = filters?.search
    ? db
        .select({ count: sql<number>`count(*)` })
        .from(contracts)
        .innerJoin(companies, eq(contracts.companyId, companies.id))
        .leftJoin(projects, eq(contracts.projectId, projects.id))
    : db.select({ count: sql<number>`count(*)` }).from(contracts);

  // Always filter by type="contract", then apply additional filters
  const conditions = [eq(contracts.type, "contract")];

  if (filters?.signed === "signed") {
    conditions.push(eq(contracts.signed, true));
  } else if (filters?.signed === "pending") {
    conditions.push(eq(contracts.signed, false));
  }

  if (filters?.search) {
    const searchTerm = `%${filters.search.toLowerCase()}%`;
    conditions.push(
      or(
        like(sql`LOWER(${contracts.name})`, searchTerm),
        like(sql`LOWER(${companies.name})`, searchTerm),
        like(sql`LOWER(${projects.title})`, searchTerm)
      )!
    );
  }

  query = query.where(and(...conditions)) as typeof query;

  const result = await query;
  return Number(result[0]?.count || 0);
}

export async function createContract(data: {
  companyId: string;
  contactId?: string | null;
  projectIds?: string[];
  name: string;
  fileStoragePath?: string | null; // Path in Supabase Storage
  fileName?: string | null;
  fileSizeBytes?: number | null;
  requiresPortalSignature?: boolean;
}) {
  const requiresPortalSignature = data.requiresPortalSignature ?? true;

  // If contract doesn't require portal signature and has a file, mark it as signed
  const signed =
    !requiresPortalSignature && data.fileStoragePath ? true : false;
  const signedAt = signed ? new Date() : null;

  // Use the first project ID for backward compatibility (deprecated field)
  const firstProjectId =
    data.projectIds && data.projectIds.length > 0 ? data.projectIds[0] : null;

  const [contract] = await db
    .insert(contracts)
    .values({
      companyId: data.companyId,
      contactId: data.contactId || null,
      projectId: firstProjectId,
      name: data.name,
      type: "contract",
      fileStoragePath: data.fileStoragePath || null,
      fileName: data.fileName || null,
      fileSizeBytes: data.fileSizeBytes || null,
      requiresPortalSignature,
      signed,
      signedAt,
    })
    .returning();

  // Create junction table entries for all selected projects
  if (data.projectIds && data.projectIds.length > 0) {
    await db.insert(contractProjects).values(
      data.projectIds.map((projectId) => ({
        contractId: contract.id,
        projectId,
      }))
    );
  }

  return contract;
}

export async function updateContract(
  contractId: string,
  data: Partial<{
    name: string;
    fileStoragePath: string | null; // Path in Supabase Storage
    fileName: string | null;
    fileSizeBytes: number | null;
    requiresPortalSignature: boolean;
    signed: boolean;
    signedAt: Date | null;
    signature: string | null;
    signedBy: string | null;
    companyId?: string;
    contactId?: string | null;
    projectIds?: string[];
  }>
) {
  // Extract projectIds if provided
  const { projectIds, ...updateData } = data;

  const [contract] = await db
    .update(contracts)
    .set(updateData)
    .where(eq(contracts.id, contractId))
    .returning();

  // Update project associations if projectIds is provided
  if (projectIds !== undefined) {
    // Delete existing associations
    await db
      .delete(contractProjects)
      .where(eq(contractProjects.contractId, contractId));

    // Create new associations
    if (projectIds.length > 0) {
      await db.insert(contractProjects).values(
        projectIds.map((projectId) => ({
          contractId: contract.id,
          projectId,
        }))
      );
    }

    // Update legacy projectId field for backward compatibility
    const firstProjectId = projectIds.length > 0 ? projectIds[0] : null;
    if (firstProjectId !== null || projectIds.length === 0) {
      await db
        .update(contracts)
        .set({ projectId: firstProjectId })
        .where(eq(contracts.id, contractId));
    }
  }

  return contract;
}

export async function deleteContract(contractId: string) {
  // Get the contract first to check if it has a Storage file
  const contract = await db
    .select({ fileStoragePath: contracts.fileStoragePath })
    .from(contracts)
    .where(eq(contracts.id, contractId))
    .limit(1);

  // Delete the contract
  await db.delete(contracts).where(eq(contracts.id, contractId));

  // Delete the file from Storage if it exists
  if (contract[0]?.fileStoragePath) {
    try {
      const { deleteContractFile } = await import("@/lib/utils/file-storage");
      await deleteContractFile(contract[0].fileStoragePath);
    } catch (error) {
      // Log error but don't fail the deletion if Storage deletion fails
      console.error("Error deleting contract file from Storage:", error);
    }
  }
}

// Expense queries
export async function createExpense(data: {
  userId: string;
  description: string;
  amount: string;
  currency?: string;
  date?: Date;
  category?: string | null;
  vendor?: string | null;
  companyId?: string | null;
  contactId?: string | null;
  invoiceUrl?: string | null; // DEPRECATED: Base64 data URL (will be migrated to Storage)
  invoiceStoragePath?: string | null; // Path in Supabase Storage
  invoiceFileName?: string | null;
  invoiceSizeBytes?: number | null;
  eurEquivalent?: string | number | null;
  exchangeRate?: string | number | null;
  exchangeRateDate?: Date | null;
  btwStatus?: string;
}) {
  const [expense] = await db
    .insert(expenses)
    .values({
      userId: data.userId,
      description: data.description,
      amount: data.amount,
      currency: data.currency || "EUR",
      date: data.date || new Date(),
      category: data.category || null,
      vendor: data.vendor || null,
      companyId: data.companyId || null,
      contactId: data.contactId || null,
      invoiceStoragePath: data.invoiceStoragePath || null,
      invoiceFileName: data.invoiceFileName || null,
      invoiceSizeBytes: data.invoiceSizeBytes || null,
      eurEquivalent:
        data.eurEquivalent != null ? String(data.eurEquivalent) : null,
      exchangeRate:
        data.exchangeRate != null ? String(data.exchangeRate) : null,
      exchangeRateDate: data.exchangeRateDate || null,
      btwStatus: data.btwStatus || "te_vorderen",
    })
    .returning();

  return expense;
}

export async function getAllExpenses() {
  return await db
    .select({
      expense: {
        id: expenses.id,
        userId: expenses.userId,
        description: expenses.description,
        amount: expenses.amount,
        currency: expenses.currency,
        date: expenses.date,
        category: expenses.category,
        vendor: expenses.vendor,
        companyId: expenses.companyId,
        contactId: expenses.contactId,
        invoiceStoragePath: expenses.invoiceStoragePath, // Path string is safe to include (not the actual file data)
        invoiceFileName: expenses.invoiceFileName,
        invoiceSizeBytes: expenses.invoiceSizeBytes,
        btwStatus: expenses.btwStatus,
        createdAt: expenses.createdAt,
        updatedAt: expenses.updatedAt,
      },
      user: {
        id: users.id,
        name: users.name,
        email: users.email,
      },
    })
    .from(expenses)
    .innerJoin(users, eq(expenses.userId, users.id))
    .orderBy(desc(expenses.date));
}

// Paginated version of getAllExpenses
export async function getAllExpensesPaginated(options?: {
  limit?: number;
  offset?: number;
  category?: string;
  search?: string;
}) {
  let query = db
    .select({
      expense: {
        id: expenses.id,
        userId: expenses.userId,
        description: expenses.description,
        amount: expenses.amount,
        currency: expenses.currency,
        date: expenses.date,
        category: expenses.category,
        vendor: expenses.vendor,
        companyId: expenses.companyId,
        contactId: expenses.contactId,
        invoiceStoragePath: expenses.invoiceStoragePath, // Path string is safe to include (not the actual file data)
        invoiceFileName: expenses.invoiceFileName,
        invoiceSizeBytes: expenses.invoiceSizeBytes,
        btwStatus: expenses.btwStatus,
        createdAt: expenses.createdAt,
        updatedAt: expenses.updatedAt,
      },
      user: {
        id: users.id,
        name: users.name,
        email: users.email,
      },
    })
    .from(expenses)
    .innerJoin(users, eq(expenses.userId, users.id));

  // Apply filters
  const conditions = [];
  if (options?.category) {
    conditions.push(eq(expenses.category, options.category));
  }
  if (options?.search) {
    const searchTerm = `%${options.search.toLowerCase()}%`;
    conditions.push(
      or(
        like(sql`LOWER(${expenses.description})`, searchTerm),
        like(sql`LOWER(${expenses.category})`, searchTerm),
        like(sql`LOWER(${expenses.vendor})`, searchTerm),
        like(sql`LOWER(${users.name})`, searchTerm),
        like(sql`LOWER(${users.email})`, searchTerm)
      )!
    );
  }

  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as typeof query;
  }

  query = query.orderBy(desc(expenses.date)) as typeof query;

  if (options?.limit) {
    query = query.limit(options.limit) as typeof query;
  }
  if (options?.offset) {
    query = query.offset(options.offset) as typeof query;
  }

  return await query;
}

// Get total count of expenses with optional filters
export async function getAllExpensesCount(filters?: {
  category?: string;
  search?: string;
}) {
  // If search is needed, we need joins, so build query with joins upfront
  let query = filters?.search
    ? db
        .select({ count: sql<number>`count(*)` })
        .from(expenses)
        .innerJoin(users, eq(expenses.userId, users.id))
    : db.select({ count: sql<number>`count(*)` }).from(expenses);

  // Apply same filters as getAllExpensesPaginated
  const conditions = [];
  if (filters?.category) {
    conditions.push(eq(expenses.category, filters.category));
  }
  if (filters?.search) {
    const searchTerm = `%${filters.search.toLowerCase()}%`;
    conditions.push(
      or(
        like(sql`LOWER(${expenses.description})`, searchTerm),
        like(sql`LOWER(${expenses.category})`, searchTerm),
        like(sql`LOWER(${expenses.vendor})`, searchTerm),
        like(sql`LOWER(${users.name})`, searchTerm),
        like(sql`LOWER(${users.email})`, searchTerm)
      )!
    );
  }
  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as typeof query;
  }

  const result = await query;
  return Number(result[0]?.count || 0);
}

export async function getExpensesByUser(userId: string) {
  return await db
    .select({
      expense: {
        id: expenses.id,
        userId: expenses.userId,
        description: expenses.description,
        amount: expenses.amount,
        currency: expenses.currency,
        date: expenses.date,
        category: expenses.category,
        vendor: expenses.vendor,
        invoiceStoragePath: expenses.invoiceStoragePath, // Path string is safe to include (not the actual file data)
        invoiceFileName: expenses.invoiceFileName,
        invoiceSizeBytes: expenses.invoiceSizeBytes,
        btwStatus: expenses.btwStatus,
        createdAt: expenses.createdAt,
        updatedAt: expenses.updatedAt,
      },
      user: {
        id: users.id,
        name: users.name,
        email: users.email,
      },
    })
    .from(expenses)
    .innerJoin(users, eq(expenses.userId, users.id))
    .where(eq(expenses.userId, userId))
    .orderBy(desc(expenses.date));
}

export async function getExpenseById(expenseId: string) {
  const result = await db
    .select({
      expense: {
        id: expenses.id,
        userId: expenses.userId,
        description: expenses.description,
        amount: expenses.amount,
        currency: expenses.currency,
        date: expenses.date,
        category: expenses.category,
        vendor: expenses.vendor,
        companyId: expenses.companyId,
        contactId: expenses.contactId,
        invoiceStoragePath: expenses.invoiceStoragePath,
        invoiceFileName: expenses.invoiceFileName,
        invoiceSizeBytes: expenses.invoiceSizeBytes,
        btwStatus: expenses.btwStatus,
        createdAt: expenses.createdAt,
        updatedAt: expenses.updatedAt,
      },
      user: {
        id: users.id,
        name: users.name,
        email: users.email,
      },
    })
    .from(expenses)
    .innerJoin(users, eq(expenses.userId, users.id))
    .where(eq(expenses.id, expenseId))
    .limit(1);

  return result[0] || null;
}

export async function updateExpense(
  expenseId: string,
  data: Partial<{
    description: string;
    amount: string;
    currency: string;
    date: Date;
    category: string | null;
    vendor: string | null;
    companyId: string | null;
    contactId: string | null;
    invoiceStoragePath: string | null; // Path in Supabase Storage
    invoiceFileName: string | null;
    invoiceSizeBytes: number | null;
    eurEquivalent: string | number | null;
    exchangeRate: string | number | null;
    exchangeRateDate: Date | null;
    btwStatus: string;
  }>
) {
  const setData: Record<string, unknown> = { ...data, updatedAt: new Date() };
  if (data.eurEquivalent !== undefined)
    setData.eurEquivalent =
      data.eurEquivalent != null ? String(data.eurEquivalent) : null;
  if (data.exchangeRate !== undefined)
    setData.exchangeRate =
      data.exchangeRate != null ? String(data.exchangeRate) : null;
  if (data.exchangeRateDate !== undefined)
    setData.exchangeRateDate = data.exchangeRateDate || null;

  const [expense] = await db
    .update(expenses)
    .set(setData as Partial<typeof expenses.$inferInsert>)
    .where(eq(expenses.id, expenseId))
    .returning();

  return expense;
}

export async function deleteExpense(expenseId: string) {
  // Get the expense first to check if it has a Storage file
  const expense = await db
    .select({ invoiceStoragePath: expenses.invoiceStoragePath })
    .from(expenses)
    .where(eq(expenses.id, expenseId))
    .limit(1);

  // Delete the expense
  await db.delete(expenses).where(eq(expenses.id, expenseId));

  // Delete the file from Storage if it exists
  if (expense[0]?.invoiceStoragePath) {
    try {
      const { deleteExpenseFile } = await import("@/lib/utils/file-storage");
      await deleteExpenseFile(expense[0].invoiceStoragePath);
    } catch (error) {
      // Log error but don't fail the deletion if Storage deletion fails
      console.error("Error deleting expense file from Storage:", error);
    }
  }
}

// Offer queries
export async function createOffer(data: {
  projectId?: string | null;
  companyId?: string | null;
  contactId?: string | null;
  note?: string | null;
  content?: string | null;
  fileStoragePath?: string | null;
  fileName?: string | null;
  fileSizeBytes?: number | null;
  status?: string;
}) {
  const [offer] = await db
    .insert(offers)
    .values({
      projectId: data.projectId || null,
      companyId: data.companyId || null,
      contactId: data.contactId || null,
      note: data.note || null,
      content: data.content || null,
      fileStoragePath: data.fileStoragePath || null,
      fileName: data.fileName || null,
      fileSizeBytes: data.fileSizeBytes || null,
      status: data.status ?? "draft",
    })
    .returning();

  return offer;
}

export async function updateOffer(
  offerId: string,
  data: Partial<{
    status: string;
    projectId: string | null;
    companyId: string | null;
    contactId: string | null;
    note: string | null;
    content: string | null;
    fileStoragePath: string | null;
    fileName: string | null;
    fileSizeBytes: number | null;
    sentAt: Date | null;
    sentToEmail: string | null;
  }>
) {
  const [offer] = await db
    .update(offers)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(offers.id, offerId))
    .returning();

  return offer;
}

export async function getOfferById(offerId: string) {
  const result = await db
    .select({
      offer: {
        id: offers.id,
        projectId: offers.projectId,
        note: offers.note,
        content: offers.content,
        fileStoragePath: offers.fileStoragePath,
        fileName: offers.fileName,
        fileSizeBytes: offers.fileSizeBytes,
        status: offers.status,
        createdAt: offers.createdAt,
        updatedAt: offers.updatedAt,
      },
      project: {
        id: projects.id,
        title: projects.title,
      },
    })
    .from(offers)
    .leftJoin(projects, eq(offers.projectId, projects.id))
    .where(eq(offers.id, offerId))
    .limit(1);

  if (!result[0]) {
    return null;
  }
  return result[0];
}

export async function getAllOffersPaginated(options?: {
  limit?: number;
  offset?: number;
  projectId?: string;
  search?: string;
}) {
  let query = db
    .select({
      offer: {
        id: offers.id,
        projectId: offers.projectId,
        note: offers.note,
        content: offers.content,
        fileStoragePath: offers.fileStoragePath,
        fileName: offers.fileName,
        fileSizeBytes: offers.fileSizeBytes,
        status: offers.status,
        createdAt: offers.createdAt,
        updatedAt: offers.updatedAt,
      },
      project: {
        id: projects.id,
        title: projects.title,
      },
    })
    .from(offers)
    .leftJoin(projects, eq(offers.projectId, projects.id));

  const conditions = [];
  if (options?.projectId) {
    conditions.push(eq(offers.projectId, options.projectId));
  }
  if (options?.search) {
    const searchTerm = `%${options.search.toLowerCase()}%`;
    conditions.push(
      or(
        like(sql`LOWER(${offers.note})`, searchTerm),
        like(sql`LOWER(${projects.title})`, searchTerm)
      )!
    );
  }

  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as typeof query;
  }

  query = query.orderBy(desc(offers.createdAt)) as typeof query;

  if (options?.limit) {
    query = query.limit(options.limit) as typeof query;
  }
  if (options?.offset) {
    query = query.offset(options.offset) as typeof query;
  }

  return await query;
}

export async function getAllOffersCount(filters?: {
  projectId?: string;
  search?: string;
}) {
  let query =
    filters?.search || filters?.projectId
      ? db
          .select({ count: sql<number>`count(*)` })
          .from(offers)
          .leftJoin(projects, eq(offers.projectId, projects.id))
      : db.select({ count: sql<number>`count(*)` }).from(offers);

  const conditions = [];
  if (filters?.projectId) {
    conditions.push(eq(offers.projectId, filters.projectId));
  }
  if (filters?.search) {
    const searchTerm = `%${filters.search.toLowerCase()}%`;
    conditions.push(
      or(
        like(sql`LOWER(${offers.note})`, searchTerm),
        like(sql`LOWER(${projects.title})`, searchTerm)
      )!
    );
  }
  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as typeof query;
  }

  const result = await query;
  return Number(result[0]?.count || 0);
}

export async function deleteOffer(offerId: string) {
  const offer = await db
    .select({ fileStoragePath: offers.fileStoragePath })
    .from(offers)
    .where(eq(offers.id, offerId))
    .limit(1);

  await db.delete(offers).where(eq(offers.id, offerId));

  if (offer[0]?.fileStoragePath) {
    try {
      const { deleteOfferFile } = await import("@/lib/utils/file-storage");
      await deleteOfferFile(offer[0].fileStoragePath);
    } catch (error) {
      console.error("Error deleting offer file from Storage:", error);
    }
  }
}

// Asset queries
export async function getAllAssets() {
  return await db
    .select({
      id: assets.id,
      name: assets.name,
      description: assets.description,
      purchaseDate: assets.purchaseDate,
      purchasePrice: assets.purchasePrice,
      residualValue: assets.residualValue,
      usefulLifeYears: assets.usefulLifeYears,
      category: assets.category,
      linkedExpenseId: assets.linkedExpenseId,
      createdAt: assets.createdAt,
    })
    .from(assets)
    .orderBy(desc(assets.purchaseDate));
}

export async function getAssetById(assetId: string) {
  const result = await db
    .select()
    .from(assets)
    .where(eq(assets.id, assetId))
    .limit(1);
  return result[0] ?? null;
}

export async function createAsset(data: {
  name: string;
  description?: string | null;
  purchaseDate: Date;
  purchasePrice: string | number;
  residualValue?: string | number;
  usefulLifeYears?: number;
  category?: string | null;
  linkedExpenseId?: string | null;
}) {
  const [asset] = await db
    .insert(assets)
    .values({
      name: data.name,
      description: data.description ?? null,
      purchaseDate: data.purchaseDate,
      purchasePrice: String(data.purchasePrice),
      residualValue:
        data.residualValue != null ? String(data.residualValue) : "0",
      usefulLifeYears: data.usefulLifeYears ?? 5,
      category: data.category ?? null,
      linkedExpenseId: data.linkedExpenseId ?? null,
    })
    .returning();
  return asset;
}

export async function updateAsset(
  assetId: string,
  data: {
    name?: string;
    description?: string | null;
    purchaseDate?: Date;
    purchasePrice?: string | number;
    residualValue?: string | number;
    usefulLifeYears?: number;
    category?: string | null;
    linkedExpenseId?: string | null;
  }
) {
  const updateObj: Record<string, unknown> = {};
  if (data.name !== undefined) updateObj.name = data.name;
  if (data.description !== undefined) updateObj.description = data.description;
  if (data.purchaseDate !== undefined)
    updateObj.purchaseDate = data.purchaseDate;
  if (data.purchasePrice !== undefined)
    updateObj.purchasePrice = String(data.purchasePrice);
  if (data.residualValue !== undefined)
    updateObj.residualValue = String(data.residualValue);
  if (data.usefulLifeYears !== undefined)
    updateObj.usefulLifeYears = data.usefulLifeYears;
  if (data.category !== undefined) updateObj.category = data.category;
  if (data.linkedExpenseId !== undefined)
    updateObj.linkedExpenseId = data.linkedExpenseId;

  const [updated] = await db
    .update(assets)
    .set(updateObj as Partial<typeof assets.$inferInsert>)
    .where(eq(assets.id, assetId))
    .returning();
  return updated;
}

export async function deleteAsset(assetId: string) {
  await db.delete(assets).where(eq(assets.id, assetId));
}

export interface BTWQuarterData {
  quarter: string;
  year: number;
  quarterNum: number;
  btwCollected: number;
  btwPaid: number;
  netPosition: number;
  isInKORPeriod: boolean;
}

/** BTW Aangifte data per quarter. Uses EXO KOR dates from constants. */
export async function getBTWAangifteData(
  year?: number
): Promise<BTWQuarterData[]> {
  const targetYear = year ?? new Date().getFullYear();
  const usdToEurRate = await getEurToUsdRate();

  const quarters: BTWQuarterData[] = [
    {
      quarter: `Q1 ${targetYear}`,
      year: targetYear,
      quarterNum: 1,
      btwCollected: 0,
      btwPaid: 0,
      netPosition: 0,
      isInKORPeriod: false,
    },
    {
      quarter: `Q2 ${targetYear}`,
      year: targetYear,
      quarterNum: 2,
      btwCollected: 0,
      btwPaid: 0,
      netPosition: 0,
      isInKORPeriod: false,
    },
    {
      quarter: `Q3 ${targetYear}`,
      year: targetYear,
      quarterNum: 3,
      btwCollected: 0,
      btwPaid: 0,
      netPosition: 0,
      isInKORPeriod: false,
    },
    {
      quarter: `Q4 ${targetYear}`,
      year: targetYear,
      quarterNum: 4,
      btwCollected: 0,
      btwPaid: 0,
      netPosition: 0,
      isInKORPeriod: false,
    },
  ];

  const quarterStarts = [
    new Date(targetYear, 0, 1),
    new Date(targetYear, 3, 1),
    new Date(targetYear, 6, 1),
    new Date(targetYear, 9, 1),
  ];
  const quarterEnds = [
    new Date(targetYear, 2, 31, 23, 59, 59, 999),
    new Date(targetYear, 5, 30, 23, 59, 59, 999),
    new Date(targetYear, 8, 30, 23, 59, 59, 999),
    new Date(targetYear, 11, 31, 23, 59, 59, 999),
  ];

  for (let q = 0; q < 4; q++) {
    // Quarter is in KOR period if it overlaps with [KOR_START_DATE, KOR_END_DATE)
    quarters[q].isInKORPeriod =
      quarterEnds[q] >= KOR_START_DATE && quarterStarts[q] < KOR_END_DATE;
  }

  const paidInvoices = await db
    .select({
      id: invoices.id,
      currency: invoices.currency,
      isKOR: invoices.isKOR,
      paidAt: invoices.paidAt,
      dueDate: invoices.dueDate,
      createdAt: invoices.createdAt,
    })
    .from(invoices)
    .where(and(eq(invoices.status, "paid"), isNull(invoices.expenseId)));

  const paidIds = paidInvoices.map((i) => i.id);
  const lineItems =
    paidIds.length > 0
      ? await db
          .select({
            invoiceId: invoiceLineItems.invoiceId,
            quantity: invoiceLineItems.quantity,
            unitPrice: invoiceLineItems.unitPrice,
            taxPercentage: invoiceLineItems.taxPercentage,
          })
          .from(invoiceLineItems)
          .where(inArray(invoiceLineItems.invoiceId, paidIds))
          .orderBy(invoiceLineItems.order)
      : [];

  const lineItemsByInv = new Map<
    string,
    Array<{
      quantity: string | number;
      unitPrice: string | number;
      taxPercentage: string | number;
    }>
  >();
  for (const item of lineItems) {
    const list = lineItemsByInv.get(item.invoiceId) ?? [];
    list.push({
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      taxPercentage: item.taxPercentage,
    });
    lineItemsByInv.set(item.invoiceId, list);
  }

  for (const inv of paidInvoices) {
    const dateForQuarter = inv.paidAt
      ? new Date(inv.paidAt)
      : inv.dueDate
        ? new Date(inv.dueDate)
        : new Date(inv.createdAt);

    let quarterIndex = -1;
    for (let q = 0; q < 4; q++) {
      if (
        dateForQuarter >= quarterStarts[q] &&
        dateForQuarter <= quarterEnds[q]
      ) {
        quarterIndex = q;
        break;
      }
    }
    if (quarterIndex < 0) continue;

    const items = lineItemsByInv.get(inv.id) ?? [];
    const vatAmount = inv.isKOR ? 0 : calculateVATFromLineItems(items);
    const vatInEUR = await convertToEUR(
      vatAmount,
      inv.currency || "EUR",
      usdToEurRate
    );
    const isDebit = true;
    quarters[quarterIndex].btwCollected += isDebit ? vatInEUR : -vatInEUR;
  }

  for (let q = 0; q < 4; q++) {
    quarters[q].netPosition = quarters[q].btwCollected - quarters[q].btwPaid;
  }

  return quarters;
}

/** Get expense IDs that are linked to assets (exclude from direct cost) */
export async function getLinkedExpenseIdsFromAssets(): Promise<Set<string>> {
  const rows = await db
    .select({ linkedExpenseId: assets.linkedExpenseId })
    .from(assets)
    .where(isNotNull(assets.linkedExpenseId));
  return new Set(
    rows.map((r) => r.linkedExpenseId).filter((id): id is string => id != null)
  );
}
