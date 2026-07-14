import { createClient } from "@/lib/supabase/server";
import {
  hasAdminAccess,
  createContact,
  getContactByEmail,
} from "@/lib/db/queries";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

/**
 * POST /api/contacts/migrate-users
 * Creates a contact for each user that doesn't have one, and links them.
 * Run once to migrate all users to contacts. Call as EXO staff.
 */
export async function POST() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user || !user.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isInEXO = await hasAdminAccess(user.email);
    if (!isInEXO) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const allUsers = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        companyId: users.companyId,
        contactId: users.contactId,
      })
      .from(users);

    let migrated = 0;
    let skipped = 0;
    let linked = 0;

    for (const u of allUsers) {
      if (u.contactId) {
        skipped++;
        continue;
      }

      let contact = await getContactByEmail(u.email);
      if (!contact) {
        const nameParts = (u.name || u.email || "").trim().split(/\s+/);
        const firstName = nameParts[0] || u.email.split("@")[0] || "User";
        const lastName = nameParts.slice(1).join(" ") || "";

        contact = await createContact({
          firstName,
          lastName: lastName || firstName,
          email: u.email,
          companyId: u.companyId,
          type: "client",
        });
        migrated++;
      } else {
        linked++;
      }

      await db
        .update(users)
        .set({ contactId: contact.id, updatedAt: new Date() })
        .where(eq(users.id, u.id));
    }

    return NextResponse.json({
      success: true,
      migrated,
      linked,
      skipped,
    });
  } catch (error) {
    console.error("Error migrating users to contacts:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
