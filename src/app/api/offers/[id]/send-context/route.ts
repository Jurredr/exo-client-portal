import { createClient } from "@/lib/supabase/server";
import { getOfferById, isUserInEXOCompany } from "@/lib/db/queries";
import { db } from "@/db";
import { projects, companies, contacts, contactCompanies } from "@/db/schema";
import { eq, and, isNotNull, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

/**
 * GET offer send context: pre-filled email, subject, and body for the send-by-email modal.
 * Prefers contact email (first contact with email at the company), fallback to company email.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: offerId } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user || !user.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isInEXO = await isUserInEXOCompany(user.email);
    if (!isInEXO) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const offerData = await getOfferById(offerId);
    if (!offerData) {
      return NextResponse.json({ error: "Offer not found" }, { status: 404 });
    }

    const projectTitle = offerData.project?.title || "the project";
    let defaultTo = "";

    if (offerData.project?.id) {
      const project = await db
        .select({ companyId: projects.companyId })
        .from(projects)
        .where(eq(projects.id, offerData.project.id))
        .limit(1);

      const companyId = project[0]?.companyId;
      if (companyId) {
        const company = await db
          .select({ email: companies.email })
          .from(companies)
          .where(eq(companies.id, companyId))
          .limit(1);

        const companyEmail = company[0]?.email?.trim() || "";

        const contactWithEmail = await db
          .select({ email: contacts.email })
          .from(contactCompanies)
          .innerJoin(contacts, eq(contactCompanies.contactId, contacts.id))
          .where(
            and(
              eq(contactCompanies.companyId, companyId),
              isNotNull(contacts.email),
              sql`TRIM(${contacts.email}) != ''`
            )
          )
          .limit(1);

        const contactEmail = contactWithEmail[0]?.email?.trim() || "";

        if (contactEmail) {
          defaultTo = contactEmail;
        } else {
          const legacyContact = await db
            .select({ email: contacts.email })
            .from(contacts)
            .where(
              and(
                eq(contacts.companyId, companyId),
                isNotNull(contacts.email),
                sql`TRIM(${contacts.email}) != ''`
              )
            )
            .limit(1);
          defaultTo = legacyContact[0]?.email?.trim() || companyEmail;
        }
      }
    }

    const defaultSubject = `EXO - Offer: ${projectTitle}`;
    const defaultBody = getDefaultOfferEmailBodyEn(offerData);

    return NextResponse.json({
      defaultTo,
      defaultSubject,
      defaultBody,
    });
  } catch (error) {
    console.error("Error fetching offer send context:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

function getDefaultOfferEmailBodyEn(offerData: {
  offer: { note?: string | null };
  project?: { title: string } | null;
}) {
  const projectTitle = offerData.project?.title || "the project";
  return `
<p>Dear recipient,</p>
<p>Please find attached our offer for <strong>${projectTitle}</strong>.</p>
${offerData.offer.note ? `<p>${offerData.offer.note}</p>` : ""}
<p>The offer is attached as a PDF.</p>
<p>Kind regards,<br>EXO</p>
  `.trim();
}
