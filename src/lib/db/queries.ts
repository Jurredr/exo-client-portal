import { db } from "@/db";
import { projects, users, organizations, hourRegistrations, userOrganizations } from "@/db/schema";
import { eq, desc, sql, inArray } from "drizzle-orm";
import { ADMIN_EMAIL_DOMAIN, EXO_ORGANIZATION_NAME } from "@/lib/constants";

export function isAdmin(email: string): boolean {
  return email.endsWith(ADMIN_EMAIL_DOMAIN);
}

export async function isUserInEXOOrganization(userEmail: string): Promise<boolean> {
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
  date?: Date
) {
  const [registration] = await db
    .insert(hourRegistrations)
    .values({
      userId,
      projectId: projectId || null,
      description,
      hours: hours.toString(),
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

  // Get user counts for each organization
  const userCounts = await db
    .select({
      organizationId: users.organizationId,
      count: sql<number>`COUNT(*)::int`.as("count"),
    })
    .from(users)
    .where(sql`${users.organizationId} IS NOT NULL`)
    .groupBy(users.organizationId);

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
  image?: string | null
) {
  // Create user with first organization as primary (for backward compatibility)
  const primaryOrgId = organizationIds && organizationIds.length > 0 ? organizationIds[0] : null;
  
  const [newUser] = await db
    .insert(users)
    .values({
      email,
      name: name || null,
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
    updatedAt: Date;
  }> = {
    ...(data.name !== undefined && { name: data.name }),
    ...(data.organizationId !== undefined && { organizationId: data.organizationId }),
    ...(data.image !== undefined && { image: data.image }),
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
    .innerJoin(organizations, eq(userOrganizations.organizationId, organizations.id));

  // Group organizations by user ID
  const orgsByUserId: Record<string, typeof organizations.$inferSelect[]> = {};
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
  subtotal: string;
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
      subtotal: data.subtotal,
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

export async function updateProject(
  projectId: string,
  data: Partial<{
    title: string;
    description: string | null;
    status: string;
    stage: string;
    startDate: Date | null;
    deadline: Date | null;
    subtotal: string;
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
  await db
    .delete(organizations)
    .where(eq(organizations.id, organizationId));
}

export async function deleteUser(userId: string) {
  await db
    .delete(users)
    .where(eq(users.id, userId));
}

export async function deleteProject(projectId: string) {
  await db
    .delete(projects)
    .where(eq(projects.id, projectId));
}
