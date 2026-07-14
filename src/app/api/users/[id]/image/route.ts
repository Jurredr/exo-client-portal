import { createClient } from "@/lib/supabase/server";
import { getUserById, hasAdminAccess } from "@/lib/db/queries";
import { getUserImageUrl } from "@/lib/utils/image-storage";
import { NextResponse } from "next/server";

/**
 * Get a signed URL for a user's profile image or return Base64 image
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

    const isInEXO = await hasAdminAccess(user.email);
    if (!isInEXO) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const dbUser = await getUserById(id);

    if (!dbUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check if there's a Storage image
    if (dbUser.imageStoragePath) {
      try {
        const signedUrl = await getUserImageUrl(dbUser.imageStoragePath);
        if (signedUrl) {
          return NextResponse.redirect(signedUrl);
        }
      } catch (error) {
        console.error("Error getting signed URL:", error);
      }
    }

    return NextResponse.json({ error: "Image not found" }, { status: 404 });
  } catch (error) {
    console.error("Error getting user image:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
