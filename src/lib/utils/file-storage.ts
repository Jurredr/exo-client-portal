/**
 * Utility functions for managing PDFs/files in Supabase Storage
 * This replaces storing Base64 files directly in the database to reduce egress usage
 * Used for contracts and expenses
 */

import { createClient } from "@/lib/supabase/server";

/**
 * Upload a file to Supabase Storage
 * @param file - The file to upload
 * @param entityId - The entity ID (contract ID or expense ID) to use in the filename
 * @param bucket - The storage bucket name (e.g., "contracts", "expenses")
 * @param folder - The folder within the bucket (e.g., "contracts", "expenses")
 * @returns The storage path if successful, null if failed
 */
export async function uploadFileToStorage(
  file: File,
  entityId: string,
  bucket: string,
  folder: string
): Promise<{ path: string; sizeBytes: number } | null> {
  try {
    const supabase = await createClient();

    // Generate a unique filename: {folder}/{entityId}-{timestamp}-{filename}
    const timestamp = Date.now();
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const storagePath = `${folder}/${entityId}-${timestamp}-${sanitizedFileName}`;

    // Convert File to ArrayBuffer for upload
    const arrayBuffer = await file.arrayBuffer();
    const fileSize = arrayBuffer.byteLength;

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(storagePath, arrayBuffer, {
        contentType: file.type || "application/pdf",
        upsert: false, // Don't overwrite existing files
      });

    if (error) {
      console.error(`Error uploading file to Storage (${bucket}):`, error);
      return null;
    }

    return {
      path: data.path,
      sizeBytes: fileSize,
    };
  } catch (error) {
    console.error(`Error uploading file to Storage (${bucket}):`, error);
    return null;
  }
}

/**
 * Delete a file from Supabase Storage
 * @param storagePath - The storage path of the file to delete
 * @param bucket - The storage bucket name
 */
export async function deleteFileFromStorage(
  storagePath: string,
  bucket: string
): Promise<boolean> {
  try {
    const supabase = await createClient();

    const { error } = await supabase.storage.from(bucket).remove([storagePath]);

    if (error) {
      console.error(`Error deleting file from Storage (${bucket}):`, error);
      return false;
    }

    return true;
  } catch (error) {
    console.error(`Error deleting file from Storage (${bucket}):`, error);
    return false;
  }
}

/**
 * Get a signed URL for downloading a file
 * @param storagePath - The storage path of the file
 * @param bucket - The storage bucket name
 * @param expiresIn - Expiration time in seconds (default: 1 hour)
 * @returns The signed URL if successful, null if failed
 */
export async function getFileSignedUrl(
  storagePath: string,
  bucket: string,
  expiresIn: number = 3600
): Promise<string | null> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(storagePath, expiresIn);

    if (error) {
      console.error(`Error creating signed URL (${bucket}):`, error);
      return null;
    }

    return data.signedUrl;
  } catch (error) {
    console.error(`Error getting file signed URL (${bucket}):`, error);
    return null;
  }
}

/**
 * Download a file from Supabase Storage as a Buffer
 * @param storagePath - The storage path of the file
 * @param bucket - The storage bucket name
 * @returns The file buffer if successful, null if failed
 */
export async function downloadFileFromStorage(
  storagePath: string,
  bucket: string
): Promise<Buffer | null> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase.storage
      .from(bucket)
      .download(storagePath);

    if (error) {
      console.error(`Error downloading file from Storage (${bucket}):`, error);
      return null;
    }

    if (!data) {
      return null;
    }

    // Convert Blob to Buffer
    const arrayBuffer = await data.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error) {
    console.error(`Error downloading file from Storage (${bucket}):`, error);
    return null;
  }
}

// Contract-specific helpers
export const CONTRACTS_BUCKET = "contracts";
export const CONTRACTS_FOLDER = "contracts";

export async function uploadContractFile(
  file: File,
  contractId: string
): Promise<{ path: string; sizeBytes: number } | null> {
  return uploadFileToStorage(
    file,
    contractId,
    CONTRACTS_BUCKET,
    CONTRACTS_FOLDER
  );
}

export async function deleteContractFile(
  storagePath: string
): Promise<boolean> {
  return deleteFileFromStorage(storagePath, CONTRACTS_BUCKET);
}

export async function downloadContractFile(
  storagePath: string
): Promise<Buffer | null> {
  return downloadFileFromStorage(storagePath, CONTRACTS_BUCKET);
}

// Expense-specific helpers
export const EXPENSES_BUCKET = "expenses";
export const EXPENSES_FOLDER = "expenses";

export async function uploadExpenseFile(
  file: File,
  expenseId: string
): Promise<{ path: string; sizeBytes: number } | null> {
  return uploadFileToStorage(file, expenseId, EXPENSES_BUCKET, EXPENSES_FOLDER);
}

export async function deleteExpenseFile(storagePath: string): Promise<boolean> {
  return deleteFileFromStorage(storagePath, EXPENSES_BUCKET);
}

export async function downloadExpenseFile(
  storagePath: string
): Promise<Buffer | null> {
  return downloadFileFromStorage(storagePath, EXPENSES_BUCKET);
}
