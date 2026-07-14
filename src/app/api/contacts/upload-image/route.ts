import { createClient } from "@/lib/supabase/server";
import { hasAdminAccess } from "@/lib/db/queries";
import { uploadContactImage } from "@/lib/utils/image-storage";
import { NextResponse } from "next/server";

/**
 * Upload a contact profile image to Supabase Storage (with compression)
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

    const isInEXO = await hasAdminAccess(user.email);
    if (!isInEXO) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;
    const contactId = formData.get("contactId") as string;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!contactId) {
      return NextResponse.json(
        { error: "Contact ID is required" },
        { status: 400 }
      );
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

    const result = await uploadContactImage(file, contactId);

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
    console.error("Error uploading contact image:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
