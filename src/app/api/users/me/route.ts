import { createClient } from "@/lib/supabase/server";
import { getUserByEmail } from "@/lib/db/queries";
import { db } from "@/db";
import { organizations, userOrganizations } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user || !user.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const dbUser = await getUserByEmail(user.email);
    if (!dbUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get primary organization (for backward compatibility)
    const primaryOrg = dbUser.organizationId
      ? await db
          .select({
            id: organizations.id,
            name: organizations.name,
          })
          .from(organizations)
          .where(eq(organizations.id, dbUser.organizationId))
          .limit(1)
      : [];

    // Get all organizations from junction table
    const userOrgs = await db
      .select({
        id: organizations.id,
        name: organizations.name,
      })
      .from(userOrganizations)
      .innerJoin(
        organizations,
        eq(userOrganizations.organizationId, organizations.id)
      )
      .where(eq(userOrganizations.userId, dbUser.id));

    return NextResponse.json({
      user: {
        id: dbUser.id,
        email: dbUser.email,
        name: dbUser.name,
        image: dbUser.image,
        phone: dbUser.phone,
        note: dbUser.note,
        organizationId: dbUser.organizationId,
        createdAt: dbUser.createdAt.toISOString(),
        updatedAt: dbUser.updatedAt.toISOString(),
      },
      organization: primaryOrg[0] || null,
      organizations: userOrgs,
    });
  } catch (error) {
    console.error("Error fetching current user:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
