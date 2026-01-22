import { createClient } from "@/lib/supabase/server";
import { isUserInEXOOrganization } from "@/lib/db/queries";
import { uploadUserImage } from "@/lib/utils/image-storage";
import { NextResponse } from "next/server";

/**
 * Upload a user profile image to Supabase Storage (with compression)
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user || !user.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isInEXO = await isUserInEXOOrganization(user.email);
    if (!isInEXO) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;
    const userId = formData.get("userId") as string;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file type
    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "Only image files are allowed" },
        { status: 400 }
      );
    }

    // Check file size (max 5MB before compression)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "File size exceeds 5MB limit" },
        { status: 400 }
      );
    }

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    // Upload and compress the image
    const result = await uploadUserImage(file, userId);

    if (!result) {
      return NextResponse.json(
        { error: "Failed to upload and compress image" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      storagePath: result.path,
      sizeBytes: result.sizeBytes,
      mimeType: result.mimeType,
    });
  } catch (error) {
    console.error("Error uploading user image:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
