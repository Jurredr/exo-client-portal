import { createClient } from "@/lib/supabase/server";
import { isUserInEXOCompany } from "@/lib/db/queries";
import { NextResponse } from "next/server";

const STORAGE_BUCKET = "contracts";
const STORAGE_FOLDER = "contracts";

/**
 * Upload a contract PDF file to Supabase Storage
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

    const isInEXO = await isUserInEXOCompany(user.email);
    if (!isInEXO) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;
    const contractId = formData.get("contractId") as string;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (file.type !== "application/pdf") {
      return NextResponse.json(
        { error: "Only PDF files are allowed" },
        { status: 400 }
      );
    }

    // Check file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "File size exceeds 10MB limit" },
        { status: 400 }
      );
    }

    // Generate a temporary contract ID if not provided (for new contracts)
    const tempContractId =
      contractId ||
      `temp-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    // Generate a unique filename: contracts/{contractId}-{timestamp}.pdf
    const timestamp = Date.now();
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const storagePath = `${STORAGE_FOLDER}/${tempContractId}-${timestamp}-${sanitizedFileName}`;

    // Convert File to ArrayBuffer for upload
    const arrayBuffer = await file.arrayBuffer();
    const fileSize = arrayBuffer.byteLength;

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, arrayBuffer, {
        contentType: file.type || "application/pdf",
        upsert: false,
      });

    if (error) {
      console.error("Error uploading contract PDF to Storage:", error);
      return NextResponse.json(
        { error: "Failed to upload PDF to Storage" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      storagePath: data.path,
      sizeBytes: fileSize,
      fileName: file.name,
    });
  } catch (error) {
    console.error("Error uploading contract PDF:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
