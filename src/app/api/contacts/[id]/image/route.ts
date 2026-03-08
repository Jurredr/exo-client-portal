import {
  getContactById,
  getUserByContactId,
  isUserInEXOCompany,
} from "@/lib/db/queries";
import { getUserImageUrl } from "@/lib/utils/image-storage";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * Get a signed URL for a contact's profile image.
 * Uses linked user's image if contact has a portal user, else contact.photo.
 */
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
    const contact = await getContactById(id);

    if (!contact) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }

    // Prefer linked user's image (portal users who had profile pics)
    const linkedUser = await getUserByContactId(id);
    const storagePath = linkedUser?.imageStoragePath || contact.photo || null;

    if (storagePath) {
      try {
        const signedUrl = await getUserImageUrl(storagePath);
        if (signedUrl) {
          return NextResponse.redirect(signedUrl);
        }
      } catch (error) {
        console.error("Error getting signed URL for contact image:", error);
      }
    }

    return NextResponse.json({ error: "Image not found" }, { status: 404 });
  } catch (error) {
    console.error("Error getting contact image:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
