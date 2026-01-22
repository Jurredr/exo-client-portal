/**
 * Utility functions for managing invoice PDFs in Supabase Storage
 * This replaces storing Base64 PDFs directly in the database to reduce egress usage
 */

import { createClient } from "@/lib/supabase/server";

const STORAGE_BUCKET = "invoices";
const STORAGE_FOLDER = "invoices";

/**
 * Upload a PDF file to Supabase Storage
 * @param file - The PDF file to upload
 * @param invoiceId - The invoice ID to use in the filename
 * @returns The storage path if successful, null if failed
 */
export async function uploadInvoicePDF(
  file: File,
  invoiceId: string
): Promise<{ path: string; sizeBytes: number } | null> {
  try {
    const supabase = await createClient();

    // Generate a unique filename: invoices/{invoiceId}-{timestamp}.pdf
    const timestamp = Date.now();
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const storagePath = `${STORAGE_FOLDER}/${invoiceId}-${timestamp}-${sanitizedFileName}`;

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
      return null;
    }

    return {
      path: data.path,
      sizeBytes: fileSize,
    };
  } catch (error) {
    console.error("Error uploading invoice PDF:", error);
    return null;
  }
}

/**
 * Delete a PDF file from Supabase Storage
 * @param storagePath - The storage path of the file to delete
 */
export async function deleteInvoicePDF(storagePath: string): Promise<boolean> {
  try {
    const supabase = await createClient();

    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .remove([storagePath]);

    if (error) {
      console.error("Error deleting PDF from Storage:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Error deleting invoice PDF:", error);
    return false;
  }
}

/**
 * Get a signed URL for downloading an invoice PDF
 * @param storagePath - The storage path of the file
 * @param expiresIn - Expiration time in seconds (default: 1 hour)
 * @returns The signed URL if successful, null if failed
 */
export async function getInvoicePDFSignedUrl(
  storagePath: string,
  expiresIn: number = 3600
): Promise<string | null> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(storagePath, expiresIn);

    if (error) {
      console.error("Error creating signed URL:", error);
      return null;
    }

    return data.signedUrl;
  } catch (error) {
    console.error("Error getting invoice PDF signed URL:", error);
    return null;
  }
}

/**
 * Download a PDF file from Supabase Storage as a Buffer
 * @param storagePath - The storage path of the file
 * @returns The PDF buffer if successful, null if failed
 */
export async function downloadInvoicePDF(
  storagePath: string
): Promise<Buffer | null> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .download(storagePath);

    if (error) {
      console.error("Error downloading PDF from Storage:", error);
      return null;
    }

    if (!data) {
      return null;
    }

    // Convert Blob to Buffer
    const arrayBuffer = await data.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error) {
    console.error("Error downloading invoice PDF:", error);
    return null;
  }
}

/**
 * Migrate a Base64 PDF from the database to Supabase Storage
 * @param base64DataUrl - The Base64 data URL (data:application/pdf;base64,...)
 * @param invoiceId - The invoice ID
 * @param fileName - The original filename
 * @returns The storage path if successful, null if failed
 */
export async function migrateBase64ToStorage(
  base64DataUrl: string,
  invoiceId: string,
  fileName: string
): Promise<{ path: string; sizeBytes: number } | null> {
  try {
    // Extract base64 data from data URL
    const base64Match = base64DataUrl.match(/^data:.*?;base64,(.+)$/);
    if (!base64Match || !base64Match[1]) {
      console.error("Invalid base64 data URL format");
      return null;
    }

    const base64Data = base64Match[1];
    const pdfBuffer = Buffer.from(base64Data, "base64");
    const fileSize = pdfBuffer.length;

    const supabase = await createClient();

    // Generate storage path
    const timestamp = Date.now();
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
    const storagePath = `${STORAGE_FOLDER}/${invoiceId}-${timestamp}-${sanitizedFileName}`;

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, pdfBuffer, {
        contentType: "application/pdf",
        upsert: false,
      });

    if (error) {
      console.error("Error migrating PDF to Storage:", error);
      return null;
    }

    return {
      path: data.path,
      sizeBytes: fileSize,
    };
  } catch (error) {
    console.error("Error migrating base64 PDF to Storage:", error);
    return null;
  }
}
