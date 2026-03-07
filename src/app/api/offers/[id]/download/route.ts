import { createClient } from "@/lib/supabase/server";
import { isUserInEXOCompany } from "@/lib/db/queries";
import { db } from "@/db";
import { offers } from "@/db/schema";
import { eq } from "drizzle-orm";
import { downloadOfferFile } from "@/lib/utils/file-storage";
import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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

    const { id } = await params;
    const [offer] = await db
      .select()
      .from(offers)
      .where(eq(offers.id, id))
      .limit(1);

    if (!offer) {
      return NextResponse.json({ error: "Offer not found" }, { status: 404 });
    }

    if (offer.fileStoragePath) {
      const fileBuffer = await downloadOfferFile(offer.fileStoragePath);
      if (fileBuffer) {
        const filename = offer.fileName || `offer-${offer.id}.pdf`;
        return new NextResponse(new Uint8Array(fileBuffer), {
          headers: {
            "Content-Type": "application/octet-stream",
            "Content-Disposition": `attachment; filename="${filename}"`,
          },
        });
      }
    }

    return NextResponse.json(
      { error: "Offer file not found" },
      { status: 404 }
    );
  } catch (error) {
    console.error("Error downloading offer file:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
