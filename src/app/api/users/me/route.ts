import { createClient } from "@/lib/supabase/server";
import { getUserByEmail } from "@/lib/db/queries";
import { db } from "@/db";
import { companies, userCompanies } from "@/db/schema";
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

    // Get primary company (for backward compatibility)
    const primaryCompany = dbUser.companyId
      ? await db
          .select({
            id: companies.id,
            name: companies.name,
          })
          .from(companies)
          .where(eq(companies.id, dbUser.companyId))
          .limit(1)
      : [];

    // Get all companies from junction table
    const userCompaniesList = await db
      .select({
        id: companies.id,
        name: companies.name,
      })
      .from(userCompanies)
      .innerJoin(companies, eq(userCompanies.companyId, companies.id))
      .where(eq(userCompanies.userId, dbUser.id));

    return NextResponse.json({
      user: {
        id: dbUser.id,
        email: dbUser.email,
        name: dbUser.name,
        imageStoragePath: dbUser.imageStoragePath,
        imageSizeBytes: dbUser.imageSizeBytes,
        phone: dbUser.phone,
        note: dbUser.note,
        companyId: dbUser.companyId,
        organizationId: dbUser.companyId, // Alias for backward compatibility
        isAdmin: dbUser.isAdmin,
        createdAt: dbUser.createdAt.toISOString(),
        updatedAt: dbUser.updatedAt.toISOString(),
      },
      organization: primaryCompany[0] || null,
      organizations: userCompaniesList,
    });
  } catch (error) {
    console.error("Error fetching current user:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
