import { db } from "@/db";
import { projects, users, organizations } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import {
  ADMIN_EMAIL_DOMAIN,
  EXO_ORGANIZATION_NAME,
} from "@/lib/constants";

export function isAdmin(email: string): boolean {
  return email.endsWith(ADMIN_EMAIL_DOMAIN);
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
  name?: string | null
): Promise<typeof users.$inferSelect> {
  // Check if user exists
  const existing = await getUserByEmail(email);
  if (existing) {
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
  if (!project) {
    return false;
  }

  // Get the user
  const user = await getUserByEmail(userEmail);
  if (!user) {
    return false;
  }

  // Check if user's organization matches project's organization
  if (!user.organizationId || !project.organizationId) {
    return false;
  }

  return user.organizationId === project.organizationId;
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
