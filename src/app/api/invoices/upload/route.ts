import { createClient } from "@/lib/supabase/server";
import { hasAdminAccess } from "@/lib/db/queries";
import { NextResponse } from "next/server";

const STORAGE_BUCKET = "invoices";
const STORAGE_FOLDER = "invoices";

/**
 * Upload an invoice PDF file to Supabase Storage
 * This endpoint handles file uploads and returns the storage path
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
    const invoiceId = formData.get("invoiceId") as string;

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

    // Generate a temporary invoice ID if not provided (for new invoices)
    const tempInvoiceId =
      invoiceId ||
      `temp-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    // Generate a unique filename: invoices/{invoiceId}-{timestamp}.pdf
    const timestamp = Date.now();
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const storagePath = `${STORAGE_FOLDER}/${tempInvoiceId}-${timestamp}-${sanitizedFileName}`;

    // Convert File to ArrayBuffer for upload
    const arrayBuffer = await file.arrayBuffer();
    const fileSize = arrayBuffer.byteLength;

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, arrayBuffer, {
        contentType: file.type || "application/pdf",
        upsert: false, // Don't overwrite existing files
      });

    if (error) {
      console.error("Error uploading PDF to Storage:", error);
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
    console.error("Error uploading invoice PDF:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
