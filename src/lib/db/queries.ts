import { db } from "@/db";
import {
  projects,
  users,
  organizations,
  hourRegistrations,
  userOrganizations,
  invoices,
  legalDocuments,
  expenses,
} from "@/db/schema";
import { eq, desc, sql, inArray, gte, lte, and } from "drizzle-orm";
import { ADMIN_EMAIL_DOMAIN, EXO_ORGANIZATION_NAME } from "@/lib/constants";

export function isAdmin(email: string): boolean {
  return email.endsWith(ADMIN_EMAIL_DOMAIN);
}

export async function isUserInEXOOrganization(
  userEmail: string
): Promise<boolean> {
  const user = await getUserByEmail(userEmail);
  if (!user) {
    return false;
  }

  const exoOrg = await getOrCreateEXOOrganization();

  // Check primary organization (backward compatibility)
  if (user.organizationId === exoOrg.id) {
    return true;
  }

  // Check junction table
  const userOrg = await db
    .select()
    .from(userOrganizations)
    .where(
      sql`${userOrganizations.userId} = ${user.id} AND ${userOrganizations.organizationId} = ${exoOrg.id}`
    )
    .limit(1);

  return userOrg.length > 0;
}

export async function getOrCreateEXOOrganization() {
  // Try to find EXO organization
  const existing = await db
    .select()
    .from(organizations)
    .where(eq(organizations.name, EXO_ORGANIZATION_NAME))
    .limit(1);

  if (existing[0]) {
    return existing[0];
  }

  // Create EXO organization if it doesn't exist
  const [newOrg] = await db
    .insert(organizations)
    .values({
      name: EXO_ORGANIZATION_NAME,
    })
    .returning();

  return newOrg;
}

export async function ensureUserExists(
  email: string,
  name?: string | null,
  image?: string | null
): Promise<typeof users.$inferSelect> {
  // Check if user exists
  const existing = await getUserByEmail(email);
  if (existing) {
    // Update image if provided and different
    if (image && existing.image !== image) {
      const [updated] = await db
        .update(users)
        .set({ image, updatedAt: new Date() })
        .where(eq(users.id, existing.id))
        .returning();
      return updated;
    }
    return existing;
  }

  // Determine organization
  let organizationId: string | null = null;
  if (isAdmin(email)) {
    const exoOrg = await getOrCreateEXOOrganization();
    organizationId = exoOrg.id;
  }

  // Create user
  const [newUser] = await db
    .insert(users)
    .values({
      email,
      name: name || null,
      image: image || null,
      organizationId,
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

export async function getUserByEmail(email: string) {
  const user = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  return user[0] || null;
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
  if (!project || !project.organizationId) {
    return false;
  }

  // Get the user
  const user = await getUserByEmail(userEmail);
  if (!user) {
    return false;
  }

  // Check primary organization (backward compatibility)
  if (user.organizationId === project.organizationId) {
    return true;
  }

  // Check junction table
  const userOrg = await db
    .select()
    .from(userOrganizations)
    .where(
      sql`${userOrganizations.userId} = ${user.id} AND ${userOrganizations.organizationId} = ${project.organizationId}`
    )
    .limit(1);

  return userOrg.length > 0;
}

export async function getProjectWithOrganization(projectId: string) {
  const result = await db
    .select({
      project: projects,
      organization: organizations,
    })
    .from(projects)
    .innerJoin(organizations, eq(projects.organizationId, organizations.id))
    .where(eq(projects.id, projectId))
    .limit(1);

  return result[0] || null;
}

export async function createHourRegistration(
  userId: string,
  description: string,
  hours: number,
  projectId?: string | null,
  date?: Date,
  category:
    | "client"
    | "administration"
    | "brainstorming"
    | "research"
    | "labs"
    | "client_acquisition" = "client"
) {
  const [registration] = await db
    .insert(hourRegistrations)
    .values({
      userId,
      projectId: projectId || null,
      description,
      hours: hours.toString(),
      category,
      date: date || new Date(),
    })
    .returning();

  return registration;
}

export async function getHourRegistrationsByUser(userId: string) {
  return await db
    .select({
      id: hourRegistrations.id,
      userId: hourRegistrations.userId,
      projectId: hourRegistrations.projectId,
      description: hourRegistrations.description,
      hours: hourRegistrations.hours,
      category: hourRegistrations.category,
      date: hourRegistrations.date,
      createdAt: hourRegistrations.createdAt,
      updatedAt: hourRegistrations.updatedAt,
      project: projects,
      user: users,
    })
    .from(hourRegistrations)
    .leftJoin(projects, eq(hourRegistrations.projectId, projects.id))
    .innerJoin(users, eq(hourRegistrations.userId, users.id))
    .where(eq(hourRegistrations.userId, userId))
    .orderBy(desc(hourRegistrations.date));
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
    date?: Date;
    category?:
      | "client"
      | "administration"
      | "brainstorming"
      | "research"
      | "labs"
      | "client_acquisition";
  }
) {
  const updateData: any = {};
  if (data.description !== undefined) updateData.description = data.description;
  if (data.hours !== undefined) updateData.hours = data.hours.toString();
  if (data.projectId !== undefined) updateData.projectId = data.projectId;
  if (data.date !== undefined) updateData.date = data.date;
  if (data.category !== undefined) updateData.category = data.category;
  updateData.updatedAt = new Date();

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

export async function createOrganization(name: string, image?: string | null) {
  const [organization] = await db
    .insert(organizations)
    .values({
      name,
      image: image || null,
    })
    .returning();

  return organization;
}

export async function updateOrganization(
  organizationId: string,
  data: {
    name: string;
    image: string | null;
  }
) {
  const [updatedOrganization] = await db
    .update(organizations)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(organizations.id, organizationId))
    .returning();

  return updatedOrganization;
}

export async function getAllOrganizations() {
  const orgs = await db
    .select()
    .from(organizations)
    .orderBy(organizations.name);

  // Get user counts for each organization from the junction table
  // This correctly counts users who are part of multiple organizations
  const userCounts = await db
    .select({
      organizationId: userOrganizations.organizationId,
      count: sql<number>`COUNT(DISTINCT ${userOrganizations.userId})::int`.as("count"),
    })
    .from(userOrganizations)
    .groupBy(userOrganizations.organizationId);

  // Create a map of organizationId -> count
  const countMap: Record<string, number> = {};
  userCounts.forEach((row) => {
    if (row.organizationId) {
      countMap[row.organizationId] = row.count;
    }
  });

  // Add user count to each organization
  return orgs.map((org) => ({
    ...org,
    userCount: countMap[org.id] || 0,
  }));
}

export async function createUser(
  email: string,
  name: string | null,
  organizationIds: string[] | null,
  image?: string | null,
  phone?: string | null,
  note?: string | null
) {
  // Create user with first organization as primary (for backward compatibility)
  const primaryOrgId =
    organizationIds && organizationIds.length > 0 ? organizationIds[0] : null;

  const [newUser] = await db
    .insert(users)
    .values({
      email,
      name: name || null,
      phone: phone || null,
      note: note || null,
      image: image || null,
      organizationId: primaryOrgId,
    })
    .returning();

  // Add all organizations to the junction table
  if (organizationIds && organizationIds.length > 0) {
    await db.insert(userOrganizations).values(
      organizationIds.map((orgId) => ({
        userId: newUser.id,
        organizationId: orgId,
      }))
    );
  }

  return newUser;
}

export async function updateUser(
  userId: string,
  data: Partial<{
    name: string | null;
    organizationId: string | null;
    organizationIds?: string[] | null;
    image: string | null;
    phone: string | null;
    note: string | null;
  }>
) {
  // If organizationIds is provided, update the junction table
  if (data.organizationIds !== undefined) {
    // Delete existing relationships
    await db
      .delete(userOrganizations)
      .where(eq(userOrganizations.userId, userId));

    // Add new relationships
    if (data.organizationIds && data.organizationIds.length > 0) {
      await db.insert(userOrganizations).values(
        data.organizationIds.map((orgId) => ({
          userId,
          organizationId: orgId,
        }))
      );

      // Update primary organizationId for backward compatibility
      data.organizationId = data.organizationIds[0];
    } else {
      data.organizationId = null;
    }
  }

  const updateData: Partial<{
    name: string | null;
    organizationId: string | null;
    image: string | null;
    phone: string | null;
    note: string | null;
    updatedAt: Date;
  }> = {
    ...(data.name !== undefined && { name: data.name }),
    ...(data.organizationId !== undefined && {
      organizationId: data.organizationId,
    }),
    ...(data.image !== undefined && { image: data.image }),
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
  // Get all users with their primary organization (for backward compatibility)
  const usersWithPrimaryOrg = await db
    .select({
      user: users,
      organization: organizations,
    })
    .from(users)
    .leftJoin(organizations, eq(users.organizationId, organizations.id))
    .orderBy(users.email);

  // Get all user-organization relationships
  const allUserOrgs = await db
    .select({
      userId: userOrganizations.userId,
      organization: organizations,
    })
    .from(userOrganizations)
    .innerJoin(
      organizations,
      eq(userOrganizations.organizationId, organizations.id)
    );

  // Group organizations by user ID
  const orgsByUserId: Record<string, (typeof organizations.$inferSelect)[]> =
    {};
  allUserOrgs.forEach((row) => {
    if (!orgsByUserId[row.userId]) {
      orgsByUserId[row.userId] = [];
    }
    orgsByUserId[row.userId].push(row.organization);
  });

  // Combine results
  return usersWithPrimaryOrg.map((row) => ({
    user: row.user,
    organization: row.organization,
    organizations: orgsByUserId[row.user.id] || [],
  }));
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
  organizationId: string;
}) {
  const [project] = await db
    .insert(projects)
    .values({
      title: data.title,
      description: data.description || null,
      status: data.status || "active",
      stage: data.stage || "kick_off",
      startDate: data.startDate || null,
      deadline: data.deadline || null,
      subtotal: data.subtotal || null,
      currency: data.currency || "EUR",
      type: data.type || "client",
      organizationId: data.organizationId,
    })
    .returning();

  return project;
}

export async function getAllProjects() {
  return await db
    .select({
      project: projects,
      organization: organizations,
    })
    .from(projects)
    .innerJoin(organizations, eq(projects.organizationId, organizations.id))
    .orderBy(desc(projects.createdAt));
}

export async function getClientProjects() {
  return await db
    .select({
      project: projects,
      organization: organizations,
    })
    .from(projects)
    .innerJoin(organizations, eq(projects.organizationId, organizations.id))
    .where(eq(projects.type, "client"))
    .orderBy(desc(projects.createdAt));
}

export async function getEXOLabsProjects() {
  return await db
    .select({
      project: projects,
      organization: organizations,
    })
    .from(projects)
    .innerJoin(organizations, eq(projects.organizationId, organizations.id))
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
  const [project] = await db
    .update(projects)
    .set({
      ...data,
      updatedAt: new Date(),
    })
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

export async function deleteOrganization(organizationId: string) {
  await db.delete(organizations).where(eq(organizations.id, organizationId));
}

export async function deleteUser(userId: string) {
  await db.delete(users).where(eq(users.id, userId));
}

export async function deleteProject(projectId: string) {
  await db.delete(projects).where(eq(projects.id, projectId));
}

export async function getDashboardStats() {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(
    now.getFullYear(),
    now.getMonth(),
    0,
    23,
    59,
    59,
    999
  );

  // Get total revenue (sum of all paid invoices)
  const totalRevenueResult = await db
    .select({
      total: sql<string>`COALESCE(SUM(${invoices.amount}::numeric), 0)`.as(
        "total"
      ),
    })
    .from(invoices)
    .where(
      and(eq(invoices.status, "paid"), sql`${invoices.paidAt} IS NOT NULL`)
    );

  const totalRevenue = parseFloat(totalRevenueResult[0]?.total || "0");

  // Get revenue this month (invoices paid this month)
  const revenueThisMonthResult = await db
    .select({
      total: sql<string>`COALESCE(SUM(${invoices.amount}::numeric), 0)`.as(
        "total"
      ),
    })
    .from(invoices)
    .where(
      and(
        eq(invoices.status, "paid"),
        sql`${invoices.paidAt} IS NOT NULL`,
        gte(invoices.paidAt, startOfMonth)
      )
    );

  const revenueThisMonth = parseFloat(revenueThisMonthResult[0]?.total || "0");

  // Get revenue last month (invoices paid last month)
  const revenueLastMonthResult = await db
    .select({
      total: sql<string>`COALESCE(SUM(${invoices.amount}::numeric), 0)`.as(
        "total"
      ),
    })
    .from(invoices)
    .where(
      and(
        eq(invoices.status, "paid"),
        sql`${invoices.paidAt} IS NOT NULL`,
        gte(invoices.paidAt, startOfLastMonth),
        lte(invoices.paidAt, endOfLastMonth)
      )
    );

  const revenueLastMonth = parseFloat(revenueLastMonthResult[0]?.total || "0");

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

  // Get hours this month
  const hoursThisMonthResult = await db
    .select({
      total:
        sql<string>`COALESCE(SUM(${hourRegistrations.hours}::numeric), 0)`.as(
          "total"
        ),
    })
    .from(hourRegistrations)
    .where(gte(hourRegistrations.date, startOfMonth));

  const hoursThisMonth = parseFloat(hoursThisMonthResult[0]?.total || "0");

  // Get hours last month
  const hoursLastMonthResult = await db
    .select({
      total:
        sql<string>`COALESCE(SUM(${hourRegistrations.hours}::numeric), 0)`.as(
          "total"
        ),
    })
    .from(hourRegistrations)
    .where(
      and(
        gte(hourRegistrations.date, startOfLastMonth),
        lte(hourRegistrations.date, endOfLastMonth)
      )
    );

  const hoursLastMonth = parseFloat(hoursLastMonthResult[0]?.total || "0");

  // Get project counts
  const totalProjects = await db.select().from(projects);
  const activeProjects = totalProjects.filter((p) => p.status === "active");
  const completedProjects = totalProjects.filter(
    (p) => p.status === "completed"
  );

  // Get organization and user counts
  const allOrganizations = await db.select().from(organizations);
  const allUsers = await db.select().from(users);

  // Calculate percentage changes
  const revenueChange =
    revenueLastMonth > 0
      ? ((revenueThisMonth - revenueLastMonth) / revenueLastMonth) * 100
      : revenueThisMonth > 0
        ? 100
        : 0;

  const hoursChange =
    hoursLastMonth > 0
      ? ((hoursThisMonth - hoursLastMonth) / hoursLastMonth) * 100
      : hoursThisMonth > 0
        ? 100
        : 0;

  // Get revenue over time (last 30 days) - based on when invoices were paid
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - 30);

  const revenueOverTime = await db
    .select({
      date: invoices.paidAt,
      revenue: invoices.amount,
      currency: invoices.currency,
    })
    .from(invoices)
    .where(
      and(
        eq(invoices.status, "paid"),
        sql`${invoices.paidAt} IS NOT NULL`,
        gte(invoices.paidAt, startDate)
      )
    )
    .orderBy(invoices.paidAt);

  // Group revenue by date
  const revenueByDate: { [key: string]: number } = {};
  revenueOverTime.forEach((row) => {
    if (row.date) {
      const dateStr = new Date(row.date).toISOString().split("T")[0];
      const amount = parseFloat(row.revenue);
      // For now, we'll sum all currencies together (could be improved with currency conversion)
      revenueByDate[dateStr] = (revenueByDate[dateStr] || 0) + amount;
    }
  });

  // Generate revenue chart data for last 30 days
  const revenueChartData: { date: string; revenue: number }[] = [];
  for (let i = 0; i <= 30; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);
    const dateStr = date.toISOString().split("T")[0];
    revenueChartData.push({
      date: dateStr,
      revenue: revenueByDate[dateStr] || 0,
    });
  }

  // Get hours over time (last 30 days)
  const hoursOverTime = await db
    .select({
      date: hourRegistrations.date,
      hours: hourRegistrations.hours,
    })
    .from(hourRegistrations)
    .where(gte(hourRegistrations.date, startDate))
    .orderBy(hourRegistrations.date);

  // Group hours by date
  const hoursByDate: { [key: string]: number } = {};
  hoursOverTime.forEach((row) => {
    const dateStr = new Date(row.date).toISOString().split("T")[0];
    hoursByDate[dateStr] = (hoursByDate[dateStr] || 0) + parseFloat(row.hours);
  });

  // Generate hours chart data for last 30 days
  const hoursChartData: { date: string; hours: number }[] = [];
  for (let i = 0; i <= 30; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);
    const dateStr = date.toISOString().split("T")[0];
    hoursChartData.push({
      date: dateStr,
      hours: hoursByDate[dateStr] || 0,
    });
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
      thisMonth: revenueThisMonth,
      lastMonth: revenueLastMonth,
      change: revenueChange,
      chartData: revenueChartData,
    },
    hours: {
      total: totalHours,
      thisMonth: hoursThisMonth,
      lastMonth: hoursLastMonth,
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

export async function getAllInvoices() {
  return await db
    .select({
      invoice: invoices,
      project: projects,
      organization: organizations,
    })
    .from(invoices)
    .leftJoin(projects, eq(invoices.projectId, projects.id))
    .innerJoin(organizations, eq(invoices.organizationId, organizations.id))
    .orderBy(desc(invoices.createdAt));
}

export async function getInvoiceById(invoiceId: string) {
  const result = await db
    .select({
      invoice: invoices,
      project: projects,
      organization: organizations,
    })
    .from(invoices)
    .leftJoin(projects, eq(invoices.projectId, projects.id))
    .innerJoin(organizations, eq(invoices.organizationId, organizations.id))
    .where(eq(invoices.id, invoiceId))
    .limit(1);

  return result[0] || null;
}

export async function getNextInvoiceNumber(): Promise<string> {
  // Get the latest invoice number
  const latestInvoice = await db
    .select({ invoiceNumber: invoices.invoiceNumber })
    .from(invoices)
    .orderBy(desc(invoices.createdAt))
    .limit(1);

  if (latestInvoice.length === 0) {
    // First invoice
    const year = new Date().getFullYear();
    return `INV-${year}-0001`;
  }

  // Extract number from latest invoice (format: INV-YYYY-NNNN)
  const latestNumber = latestInvoice[0].invoiceNumber;
  const match = latestNumber.match(/INV-(\d{4})-(\d+)/);

  if (!match) {
    // If format doesn't match, start fresh
    const year = new Date().getFullYear();
    return `INV-${year}-0001`;
  }

  const latestYear = parseInt(match[1]);
  const latestNum = parseInt(match[2]);
  const currentYear = new Date().getFullYear();

  if (latestYear === currentYear) {
    // Same year, increment number
    const nextNum = latestNum + 1;
    return `INV-${currentYear}-${String(nextNum).padStart(4, "0")}`;
  } else {
    // New year, start from 0001
    return `INV-${currentYear}-0001`;
  }
}

export async function createInvoice(data: {
  invoiceNumber: string;
  projectId?: string | null;
  organizationId: string;
  amount: string;
  currency?: string;
  status?: string;
  type?: string;
  description?: string | null;
  dueDate?: Date | null;
  pdfUrl?: string | null;
  pdfFileName?: string | null;
  pdfFileType?: string | null;
}) {
  const [invoice] = await db
    .insert(invoices)
    .values({
      invoiceNumber: data.invoiceNumber,
      projectId: data.projectId || null,
      organizationId: data.organizationId,
      amount: data.amount,
      currency: data.currency || "EUR",
      status: data.status || "draft",
      type: data.type || "manual",
      description: data.description || null,
      dueDate: data.dueDate || null,
      pdfUrl: data.pdfUrl || null,
      pdfFileName: data.pdfFileName || null,
      pdfFileType: data.pdfFileType || null,
    })
    .returning();

  return invoice;
}

export async function updateInvoice(
  invoiceId: string,
  data: Partial<{
    organizationId: string;
    projectId: string | null;
    status: string;
    amount: string;
    currency: string;
    description: string | null;
    dueDate: Date | null;
    paidAt: Date | null;
    pdfUrl: string | null;
    pdfFileName: string | null;
    pdfFileType: string | null;
  }>
) {
  const [invoice] = await db
    .update(invoices)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(invoices.id, invoiceId))
    .returning();

  return invoice;
}

export async function deleteInvoice(invoiceId: string) {
  await db.delete(invoices).where(eq(invoices.id, invoiceId));
}

// Contract queries (using legal_documents table with type='contract')
export async function getAllContracts() {
  return await db
    .select({
      contract: legalDocuments,
      project: projects,
      organization: organizations,
      signedByUser: users,
    })
    .from(legalDocuments)
    .innerJoin(projects, eq(legalDocuments.projectId, projects.id))
    .innerJoin(organizations, eq(projects.organizationId, organizations.id))
    .leftJoin(users, eq(legalDocuments.signedBy, users.id))
    .where(eq(legalDocuments.type, "contract"))
    .orderBy(desc(legalDocuments.createdAt));
}

export async function getContractById(contractId: string) {
  const result = await db
    .select({
      contract: legalDocuments,
      project: projects,
      organization: organizations,
      signedByUser: users,
    })
    .from(legalDocuments)
    .innerJoin(projects, eq(legalDocuments.projectId, projects.id))
    .innerJoin(organizations, eq(projects.organizationId, organizations.id))
    .leftJoin(users, eq(legalDocuments.signedBy, users.id))
    .where(
      and(
        eq(legalDocuments.id, contractId),
        eq(legalDocuments.type, "contract")
      )
    )
    .limit(1);

  return result[0] || null;
}

export async function createContract(data: {
  projectId: string;
  name: string;
  fileUrl?: string | null;
}) {
  const [contract] = await db
    .insert(legalDocuments)
    .values({
      projectId: data.projectId,
      name: data.name,
      type: "contract",
      fileUrl: data.fileUrl || null,
      signed: false,
    })
    .returning();

  return contract;
}

export async function updateContract(
  contractId: string,
  data: Partial<{
    name: string;
    fileUrl: string | null;
    signed: boolean;
    signedAt: Date | null;
    signature: string | null;
    signedBy: string | null;
  }>
) {
  const [contract] = await db
    .update(legalDocuments)
    .set(data)
    .where(eq(legalDocuments.id, contractId))
    .returning();

  return contract;
}

export async function deleteContract(contractId: string) {
  await db.delete(legalDocuments).where(eq(legalDocuments.id, contractId));
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
  invoiceUrl?: string | null;
  invoiceFileName?: string | null;
  invoiceFileType?: string | null;
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
      invoiceUrl: data.invoiceUrl || null,
      invoiceFileName: data.invoiceFileName || null,
      invoiceFileType: data.invoiceFileType || null,
    })
    .returning();

  return expense;
}

export async function getAllExpenses() {
  return await db
    .select({
      expense: expenses,
      user: users,
    })
    .from(expenses)
    .innerJoin(users, eq(expenses.userId, users.id))
    .orderBy(desc(expenses.date));
}

export async function getExpensesByUser(userId: string) {
  return await db
    .select({
      expense: expenses,
      user: users,
    })
    .from(expenses)
    .innerJoin(users, eq(expenses.userId, users.id))
    .where(eq(expenses.userId, userId))
    .orderBy(desc(expenses.date));
}

export async function getExpenseById(expenseId: string) {
  const result = await db
    .select({
      expense: expenses,
      user: users,
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
    invoiceUrl: string | null;
    invoiceFileName: string | null;
    invoiceFileType: string | null;
  }>
) {
  const [expense] = await db
    .update(expenses)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(expenses.id, expenseId))
    .returning();

  return expense;
}

export async function deleteExpense(expenseId: string) {
  await db.delete(expenses).where(eq(expenses.id, expenseId));
}
