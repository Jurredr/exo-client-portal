import { db } from "@/db";
import {
  projects,
  users,
  organizations,
  hourRegistrations,
  userOrganizations,
  invoices,
  invoiceLineItems,
  contracts,
  contractProjects,
  expenses,
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
} from "drizzle-orm";
import {
  ADMIN_EMAIL_DOMAIN,
  EXO_ORGANIZATION_NAME,
  VAT_PERCENTAGE,
} from "@/lib/constants";

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
  imageStoragePath?: string | null, // Path in Supabase Storage
  imageSizeBytes?: number | null
): Promise<typeof users.$inferSelect> {
  // Check if user exists
  const existing = await getUserByEmail(email);
  if (existing) {
    // Update image if provided and different
    if (imageStoragePath && existing.imageStoragePath !== imageStoragePath) {
      const [updated] = await db
        .update(users)
        .set({
          imageStoragePath,
          imageSizeBytes: imageSizeBytes || null,
          updatedAt: new Date(),
        })
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
      imageStoragePath: imageStoragePath || null,
      imageSizeBytes: imageSizeBytes || null,
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

export async function getUserById(userId: string) {
  const user = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
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
    | "client_acquisition"
    | "content_creation"
    | "traveling" = "client"
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
    date?: Date;
    category?: string;
    updatedAt?: Date;
  } = {
    updatedAt: new Date(),
  };
  if (data.description !== undefined) updateData.description = data.description;
  if (data.hours !== undefined) updateData.hours = data.hours.toString();
  if (data.projectId !== undefined) updateData.projectId = data.projectId;
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

export async function createOrganization(data: {
  name: string;
  imageStoragePath?: string | null; // Path in Supabase Storage
  imageSizeBytes?: number | null;
  address?: string | null;
  kvkNumber?: string | null;
  btwNumber?: string | null;
  email?: string | null;
  telephone?: string | null;
}) {
  const [organization] = await db
    .insert(organizations)
    .values({
      name: data.name,
      imageStoragePath: data.imageStoragePath || null,
      imageSizeBytes: data.imageSizeBytes || null,
      address: data.address || null,
      kvkNumber: data.kvkNumber || null,
      btwNumber: data.btwNumber || null,
      email: data.email || null,
      telephone: data.telephone || null,
    })
    .returning();

  return organization;
}

export async function updateOrganization(
  organizationId: string,
  data: {
    name: string;
    imageStoragePath?: string | null; // Path in Supabase Storage
    imageSizeBytes?: number | null;
    address?: string | null;
    kvkNumber?: string | null;
    btwNumber?: string | null;
    email?: string | null;
    telephone?: string | null;
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
  // CRITICAL: Exclude image Base64 data from list queries to avoid transferring large data
  const orgs = await db
    .select({
      id: organizations.id,
      name: organizations.name,
      imageStoragePath: organizations.imageStoragePath, // Path string is safe to include
      imageSizeBytes: organizations.imageSizeBytes,
      address: organizations.address,
      kvkNumber: organizations.kvkNumber,
      btwNumber: organizations.btwNumber,
      email: organizations.email,
      telephone: organizations.telephone,
      createdAt: organizations.createdAt,
      updatedAt: organizations.updatedAt,
    })
    .from(organizations)
    .orderBy(organizations.name);

  // Get user counts for each organization from the junction table
  // This correctly counts users who are part of multiple organizations
  const userCounts = await db
    .select({
      organizationId: userOrganizations.organizationId,
      count: sql<number>`COUNT(DISTINCT ${userOrganizations.userId})::int`.as(
        "count"
      ),
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

export async function getOrganizationById(organizationId: string) {
  const org = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);

  return org[0] || null;
}

export async function createUser(
  email: string,
  name: string | null,
  organizationIds: string[] | null,
  imageStoragePath?: string | null, // Path in Supabase Storage
  imageSizeBytes?: number | null,
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
      imageStoragePath: imageStoragePath || null,
      imageSizeBytes: imageSizeBytes || null,
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
    imageStoragePath?: string | null; // Path in Supabase Storage
    imageSizeBytes?: number | null;
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
    imageStoragePath: string | null;
    imageSizeBytes: number | null;
    phone: string | null;
    note: string | null;
    updatedAt: Date;
  }> = {
    ...(data.name !== undefined && { name: data.name }),
    ...(data.organizationId !== undefined && {
      organizationId: data.organizationId,
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
  // Get all users with their primary organization (for backward compatibility)
  const usersWithPrimaryOrg = await db
    .select({
      user: {
        id: users.id,
        email: users.email,
        name: users.name,
        phone: users.phone,
        note: users.note,
        imageStoragePath: users.imageStoragePath, // Path string is safe to include
        imageSizeBytes: users.imageSizeBytes,
        organizationId: users.organizationId,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      },
      organization: {
        id: organizations.id,
        name: organizations.name,
      },
    })
    .from(users)
    .leftJoin(organizations, eq(users.organizationId, organizations.id))
    .orderBy(users.email);

  // Get all user-organization relationships
  const allUserOrgs = await db
    .select({
      userId: userOrganizations.userId,
      organization: {
        id: organizations.id,
        name: organizations.name,
      },
    })
    .from(userOrganizations)
    .innerJoin(
      organizations,
      eq(userOrganizations.organizationId, organizations.id)
    );

  // Group organizations by user ID
  const orgsByUserId: Record<string, Array<{ id: string; name: string }>> = {};
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

// Paginated version of getAllUsers
export async function getAllUsersPaginated(options?: {
  limit?: number;
  offset?: number;
  organizationId?: string;
  search?: string;
}) {
  // CRITICAL: Exclude image Base64 data from list queries to avoid transferring large data
  // Get paginated users with their primary organization
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
        organizationId: users.organizationId,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      },
      organization: {
        id: organizations.id,
        name: organizations.name,
      },
    })
    .from(users)
    .leftJoin(organizations, eq(users.organizationId, organizations.id));

  // Apply filters
  const conditions = [];
  if (options?.organizationId) {
    // Filter by organization - check both primary organization and junction table
    const userOrgIds = await db
      .select({ userId: userOrganizations.userId })
      .from(userOrganizations)
      .where(eq(userOrganizations.organizationId, options.organizationId));
    const userIds = userOrgIds.map((row) => row.userId);

    // Also include users with this as primary organization
    if (userIds.length > 0) {
      conditions.push(
        or(
          eq(users.organizationId, options.organizationId),
          inArray(users.id, userIds)
        )!
      );
    } else {
      // If no users in junction table, only check primary organization
      conditions.push(eq(users.organizationId, options.organizationId));
    }
  }
  if (options?.search) {
    const searchTerm = `%${options.search.toLowerCase()}%`;
    conditions.push(
      or(
        like(sql`LOWER(${users.email})`, searchTerm),
        like(sql`LOWER(${users.name})`, searchTerm),
        like(sql`LOWER(${organizations.name})`, searchTerm)
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

  // Get all user-organization relationships for these users
  const allUserOrgs =
    userIds.length > 0
      ? await db
          .select({
            userId: userOrganizations.userId,
            organization: organizations,
          })
          .from(userOrganizations)
          .innerJoin(
            organizations,
            eq(userOrganizations.organizationId, organizations.id)
          )
          .where(inArray(userOrganizations.userId, userIds))
      : [];

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

// Get total count of users with optional filters
export async function getAllUsersCount(filters?: {
  organizationId?: string;
  search?: string;
}) {
  let query = db
    .select({ count: sql<number>`count(*)` })
    .from(users)
    .leftJoin(organizations, eq(users.organizationId, organizations.id));

  const conditions = [];
  if (filters?.organizationId) {
    // Filter by organization - check both primary organization and junction table
    const userOrgIds = await db
      .select({ userId: userOrganizations.userId })
      .from(userOrganizations)
      .where(eq(userOrganizations.organizationId, filters.organizationId));
    const userIds = userOrgIds.map((row) => row.userId);

    // Also include users with this as primary organization
    if (userIds.length > 0) {
      conditions.push(
        or(
          eq(users.organizationId, filters.organizationId),
          inArray(users.id, userIds)
        )!
      );
    } else {
      // If no users in junction table, only check primary organization
      conditions.push(eq(users.organizationId, filters.organizationId));
    }
  }
  if (filters?.search) {
    const searchTerm = `%${filters.search.toLowerCase()}%`;
    conditions.push(
      or(
        like(sql`LOWER(${users.email})`, searchTerm),
        like(sql`LOWER(${users.name})`, searchTerm),
        like(sql`LOWER(${organizations.name})`, searchTerm)
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
        organizationId: projects.organizationId,
        createdAt: projects.createdAt,
        updatedAt: projects.updatedAt,
      },
      organization: {
        id: organizations.id,
        name: organizations.name,
      },
    })
    .from(projects)
    .innerJoin(organizations, eq(projects.organizationId, organizations.id))
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
        title: projects.title,
        description: projects.description,
        status: projects.status,
        stage: projects.stage,
        startDate: projects.startDate,
        deadline: projects.deadline,
        subtotal: projects.subtotal,
        currency: projects.currency,
        type: projects.type,
        organizationId: projects.organizationId,
        createdAt: projects.createdAt,
        updatedAt: projects.updatedAt,
      },
      organization: {
        id: organizations.id,
        name: organizations.name,
      },
    })
    .from(projects)
    .innerJoin(organizations, eq(projects.organizationId, organizations.id));

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
        like(sql`LOWER(${organizations.name})`, searchTerm),
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
    .innerJoin(organizations, eq(projects.organizationId, organizations.id));

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
        like(sql`LOWER(${organizations.name})`, searchTerm),
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
        organizationId: projects.organizationId,
        createdAt: projects.createdAt,
        updatedAt: projects.updatedAt,
      },
      organization: {
        id: organizations.id,
        name: organizations.name,
      },
    })
    .from(projects)
    .innerJoin(organizations, eq(projects.organizationId, organizations.id))
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
        organizationId: projects.organizationId,
        createdAt: projects.createdAt,
        updatedAt: projects.updatedAt,
      },
      organization: {
        id: organizations.id,
        name: organizations.name,
      },
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
  // Get the organization first to check if it has a Storage image
  const org = await db
    .select({ imageStoragePath: organizations.imageStoragePath })
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);

  // Delete the organization
  await db.delete(organizations).where(eq(organizations.id, organizationId));

  // Delete the image from Storage if it exists
  if (org[0]?.imageStoragePath) {
    try {
      const { deleteOrganizationImage } =
        await import("@/lib/utils/image-storage");
      await deleteOrganizationImage(org[0].imageStoragePath);
    } catch (error) {
      // Log error but don't fail the deletion if Storage deletion fails
      console.error("Error deleting organization image from Storage:", error);
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

// Helper function to parse invoice amount (removes currency symbols, commas, spaces)
function parseInvoiceAmount(amount: string): number {
  if (!amount) return 0;
  // Remove currency symbols (€, $), commas, spaces, and other non-numeric characters except decimal point
  const cleaned = amount.replace(/[€$,\s]/g, "").trim();
  const parsed = parseFloat(cleaned);
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
  hoursTimeRange: string = "30d"
) {
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

  // Fetch exchange rate once at the beginning to avoid multiple API calls
  const usdToEurRate = await getEurToUsdRate();

  // Get all paid invoices with their amounts and transaction types
  // Only require status = "paid", paidAt is optional
  const paidInvoices = await db
    .select({
      amount: invoices.amount,
      currency: invoices.currency,
      transactionType: invoices.transactionType,
      dueDate: invoices.dueDate,
      paidAt: invoices.paidAt,
      createdAt: invoices.createdAt,
    })
    .from(invoices)
    .where(and(eq(invoices.status, "paid"), isNull(invoices.expenseId)));

  // Calculate total revenue (debits add, credits subtract)
  let totalRevenue = 0;
  let revenueThisMonth = 0;
  let revenueLastMonth = 0;

  for (const invoice of paidInvoices) {
    const amount = parseInvoiceAmount(invoice.amount);
    // Convert to EUR if needed
    const amountInEUR = await convertToEUR(
      amount,
      invoice.currency || "EUR",
      usdToEurRate
    );
    // Default to debit if transactionType is null (for invoices created before migration)
    const isDebit = (invoice.transactionType || "debit") === "debit";
    const value = isDebit ? amountInEUR : -amountInEUR; // Credits subtract from revenue

    totalRevenue += value;

    // Use dueDate if available, otherwise use paidAt, then createdAt as fallback
    const dateForCalculation = invoice.dueDate
      ? new Date(invoice.dueDate)
      : invoice.paidAt
        ? new Date(invoice.paidAt)
        : new Date(invoice.createdAt);

    if (dateForCalculation >= startOfMonth) {
      revenueThisMonth += value;
    }
    if (
      dateForCalculation >= startOfLastMonth &&
      dateForCalculation <= endOfLastMonth
    ) {
      revenueLastMonth += value;
    }
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

  // Get organization and user counts (unused but kept for potential future use)
  // const allOrganizations = await db.select().from(organizations);
  // const allUsers = await db.select().from(users);

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

  // Calculate revenue chart date range based on time range parameter
  let revenueStartDate: Date;
  let revenueEndDate: Date = now;
  let revenueDaysToShow = 0;
  let revenueGroupByMonth = false;

  if (revenueTimeRange === "year") {
    revenueStartDate = new Date(now.getFullYear(), 0, 1); // January 1st of current year
    revenueEndDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999); // December 31st
    revenueGroupByMonth = true;
  } else {
    const days =
      revenueTimeRange === "90d" ? 90 : revenueTimeRange === "30d" ? 30 : 7;
    revenueStartDate = new Date(now);
    revenueStartDate.setDate(revenueStartDate.getDate() - days);
    revenueDaysToShow = days;
  }

  const revenueOverTime = await db
    .select({
      dueDate: invoices.dueDate,
      paidAt: invoices.paidAt,
      createdAt: invoices.createdAt,
      amount: invoices.amount,
      transactionType: invoices.transactionType,
      currency: invoices.currency,
    })
    .from(invoices)
    .where(and(eq(invoices.status, "paid"), isNull(invoices.expenseId)))
    .orderBy(invoices.dueDate);

  // Group revenue by date/month (debits add, credits subtract)
  const revenueByDate: { [key: string]: number } = {};
  for (const row of revenueOverTime) {
    // Use dueDate if available, otherwise use paidAt, then createdAt as fallback
    const dateForChart = row.dueDate
      ? new Date(row.dueDate)
      : row.paidAt
        ? new Date(row.paidAt)
        : new Date(row.createdAt);

    // Only include if within the selected time range
    if (dateForChart >= revenueStartDate && dateForChart <= revenueEndDate) {
      let dateKey: string;
      if (revenueGroupByMonth) {
        // Format as YYYY-MM for monthly grouping
        dateKey = `${dateForChart.getFullYear()}-${String(dateForChart.getMonth() + 1).padStart(2, "0")}`;
      } else {
        // Format as YYYY-MM-DD for daily grouping
        dateKey = dateForChart.toISOString().split("T")[0];
      }
      const amount = parseInvoiceAmount(row.amount);
      // Convert to EUR if needed
      const amountInEUR = await convertToEUR(
        amount,
        row.currency || "EUR",
        usdToEurRate
      );
      // Default to debit if transactionType is null
      const isDebit = (row.transactionType || "debit") === "debit";
      const value = isDebit ? amountInEUR : -amountInEUR; // Credits subtract from revenue
      revenueByDate[dateKey] = (revenueByDate[dateKey] || 0) + value;
    }
  }

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
  }

  const hoursOverTime = await db
    .select({
      date: hourRegistrations.date,
      hours: hourRegistrations.hours,
    })
    .from(hourRegistrations)
    .where(gte(hourRegistrations.date, hoursStartDate))
    .orderBy(hourRegistrations.date);

  // Group hours by date/month
  const hoursByDate: { [key: string]: number } = {};
  hoursOverTime.forEach((row) => {
    const rowDate = new Date(row.date);
    // Only include if within the selected time range
    if (rowDate >= hoursStartDate && rowDate <= hoursEndDate) {
      let dateKey: string;
      if (hoursGroupByMonth) {
        // Format as YYYY-MM for monthly grouping
        dateKey = `${rowDate.getFullYear()}-${String(rowDate.getMonth() + 1).padStart(2, "0")}`;
      } else {
        // Format as YYYY-MM-DD for daily grouping
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
  // CRITICAL: Exclude pdfStoragePath from list queries to avoid transferring metadata
  // We'll use pdfFileName to check if a PDF exists, and only fetch pdfStoragePath when downloading
  const results = await db
    .select({
      invoice: {
        id: invoices.id,
        invoiceNumber: invoices.invoiceNumber,
        projectId: invoices.projectId,
        organizationId: invoices.organizationId,
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
      organization: {
        id: organizations.id,
        name: organizations.name,
      },
    })
    .from(invoices)
    .leftJoin(projects, eq(invoices.projectId, projects.id))
    .innerJoin(organizations, eq(invoices.organizationId, organizations.id))
    .orderBy(desc(invoices.createdAt));

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
        organizationId: invoices.organizationId,
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
      organization: {
        id: organizations.id,
        name: organizations.name,
      },
    })
    .from(invoices)
    .leftJoin(projects, eq(invoices.projectId, projects.id))
    .innerJoin(organizations, eq(invoices.organizationId, organizations.id));

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
        like(sql`LOWER(${organizations.name})`, searchTerm),
        like(sql`LOWER(${projects.title})`, searchTerm),
        like(sql`LOWER(${invoices.description})`, searchTerm)
      )!
    );
  }

  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as typeof query;
  }

  query = query.orderBy(desc(invoices.createdAt)) as typeof query;

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
        .innerJoin(organizations, eq(invoices.organizationId, organizations.id))
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
        like(sql`LOWER(${organizations.name})`, searchTerm),
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

export async function getInvoiceById(invoiceId: string) {
  const result = await db
    .select({
      invoice: {
        id: invoices.id,
        invoiceNumber: invoices.invoiceNumber,
        projectId: invoices.projectId,
        organizationId: invoices.organizationId,
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
      organization: {
        id: organizations.id,
        name: organizations.name,
      },
    })
    .from(invoices)
    .leftJoin(projects, eq(invoices.projectId, projects.id))
    .innerJoin(organizations, eq(invoices.organizationId, organizations.id))
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
  organizationId: string;
  expenseId?: string | null;
  amount: string;
  currency?: string;
  status?: string;
  type?: string;
  transactionType?: string;
  vatIncluded?: boolean | null;
  isKOR?: boolean;
  description?: string | null;
  invoiceDate?: Date | null;
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
  const [invoice] = await db
    .insert(invoices)
    .values({
      invoiceNumber: data.invoiceNumber,
      projectId: data.projectId || null,
      organizationId: data.organizationId,
      expenseId: data.expenseId ?? null,
      amount: data.amount,
      currency: data.currency || "EUR",
      status: data.status || "draft",
      type: data.type || "manual",
      transactionType: data.transactionType || "debit",
      vatIncluded: data.vatIncluded !== undefined ? data.vatIncluded : null,
      isKOR: data.isKOR || false,
      description: data.description || null,
      invoiceDate: data.invoiceDate || null,
      dueDate: data.dueDate || null,
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
    organizationId: string;
    projectId: string | null;
    status: string;
    expenseId: string | null;
    amount: string;
    currency: string;
    transactionType: string;
    vatIncluded: boolean | null;
    isKOR: boolean;
    description: string | null;
    invoiceDate: Date | null;
    dueDate: Date | null;
    paidAt: Date | null;
    pdfStoragePath: string | null; // Path in Supabase Storage
    pdfFileName: string | null;
    pdfSizeBytes: number | null;
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
  // Get all contracts with their organization and first project (for backward compatibility)
  // Note: fileStoragePath is just a path string, not the file data, so it's safe to include
  const contractsList = await db
    .select({
      contract: {
        id: contracts.id,
        organizationId: contracts.organizationId,
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
      organization: {
        id: organizations.id,
        name: organizations.name,
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
    .innerJoin(organizations, eq(contracts.organizationId, organizations.id))
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
            organization: {
              id: organizations.id,
              name: organizations.name,
            },
          })
          .from(contractProjects)
          .innerJoin(projects, eq(contractProjects.projectId, projects.id))
          .innerJoin(
            organizations,
            eq(projects.organizationId, organizations.id)
          )
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
        organizations: [contract.organization], // Always has organization now
      };
    }
    // Always include the contract's organization, plus any from projects
    const allOrganizations = new Map();
    allOrganizations.set(contract.organization.id, contract.organization);
    associatedProjects.forEach((a) => {
      allOrganizations.set(a.organization.id, a.organization);
    });
    return {
      ...contract,
      projects: associatedProjects.map((a) => a.project),
      organizations: Array.from(allOrganizations.values()),
    };
  });
}

export async function getContractById(contractId: string) {
  const result = await db
    .select({
      contract: {
        id: contracts.id,
        organizationId: contracts.organizationId,
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
      organization: {
        id: organizations.id,
        name: organizations.name,
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
    .innerJoin(organizations, eq(contracts.organizationId, organizations.id))
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
      organization: {
        id: organizations.id,
        name: organizations.name,
      },
    })
    .from(contractProjects)
    .innerJoin(projects, eq(contractProjects.projectId, projects.id))
    .innerJoin(organizations, eq(projects.organizationId, organizations.id))
    .where(eq(contractProjects.contractId, contractId));

  // Always include the contract's organization, plus any from projects
  const allOrganizations = new Map();
  allOrganizations.set(result[0].organization.id, result[0].organization);
  projectAssociations.forEach((a) => {
    allOrganizations.set(a.organization.id, a.organization);
  });

  // If no projects from junction table but has legacy projectId, use that
  if (projectAssociations.length === 0 && result[0].project) {
    return {
      ...result[0],
      projects: [result[0].project],
      organizations: Array.from(allOrganizations.values()),
    };
  }

  return {
    ...result[0],
    projects: projectAssociations.map((a) => a.project),
    organizations: Array.from(allOrganizations.values()),
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
        organizationId: contracts.organizationId,
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
      organization: {
        id: organizations.id,
        name: organizations.name,
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
    .innerJoin(organizations, eq(contracts.organizationId, organizations.id))
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
        like(sql`LOWER(${organizations.name})`, searchTerm),
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
            organization: {
              id: organizations.id,
              name: organizations.name,
            },
          })
          .from(contractProjects)
          .innerJoin(projects, eq(contractProjects.projectId, projects.id))
          .innerJoin(
            organizations,
            eq(projects.organizationId, organizations.id)
          )
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
        organizations: [contract.organization],
      };
    }

    // Get unique organizations from projects
    const allOrganizations = new Map<string, typeof contract.organization>();
    allOrganizations.set(contract.organization.id, contract.organization);
    associatedProjects.forEach((assoc) => {
      if (!allOrganizations.has(assoc.organization.id)) {
        allOrganizations.set(assoc.organization.id, assoc.organization);
      }
    });

    return {
      ...contract,
      projects: associatedProjects.map((a) => a.project),
      organizations: Array.from(allOrganizations.values()),
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
        .innerJoin(
          organizations,
          eq(contracts.organizationId, organizations.id)
        )
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
        like(sql`LOWER(${organizations.name})`, searchTerm),
        like(sql`LOWER(${projects.title})`, searchTerm)
      )!
    );
  }

  query = query.where(and(...conditions)) as typeof query;

  const result = await query;
  return Number(result[0]?.count || 0);
}

export async function createContract(data: {
  organizationId: string;
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
      organizationId: data.organizationId,
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
    organizationId?: string;
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
  invoiceUrl?: string | null; // DEPRECATED: Base64 data URL (will be migrated to Storage)
  invoiceStoragePath?: string | null; // Path in Supabase Storage
  invoiceFileName?: string | null;
  invoiceSizeBytes?: number | null;
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
      invoiceStoragePath: data.invoiceStoragePath || null,
      invoiceFileName: data.invoiceFileName || null,
      invoiceSizeBytes: data.invoiceSizeBytes || null,
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
        invoiceStoragePath: expenses.invoiceStoragePath, // Path string is safe to include (not the actual file data)
        invoiceFileName: expenses.invoiceFileName,
        invoiceSizeBytes: expenses.invoiceSizeBytes,
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
        invoiceStoragePath: expenses.invoiceStoragePath, // Path string is safe to include (not the actual file data)
        invoiceFileName: expenses.invoiceFileName,
        invoiceSizeBytes: expenses.invoiceSizeBytes,
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
        invoiceStoragePath: expenses.invoiceStoragePath,
        invoiceFileName: expenses.invoiceFileName,
        invoiceSizeBytes: expenses.invoiceSizeBytes,
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
    invoiceStoragePath: string | null; // Path in Supabase Storage
    invoiceFileName: string | null;
    invoiceSizeBytes: number | null;
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
