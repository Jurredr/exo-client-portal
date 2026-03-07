/**
 * Utility functions for managing profile images in Supabase Storage
 * Used for users and organizations
 */

import { createClient } from "@/lib/supabase/server";
import {
  compressUserImage,
  compressOrganizationImage,
} from "./image-compression";

const USERS_BUCKET = "users";
const USERS_FOLDER = "users";
const ORGANIZATIONS_BUCKET = "organizations";
const ORGANIZATIONS_FOLDER = "organizations";

/**
 * Upload a compressed user profile image to Supabase Storage
 * @param file - The image file to upload
 * @param userId - The user ID to use in the filename (can be temp ID for new users)
 * @returns The storage path and size if successful, null if failed
 */
export async function uploadUserImage(
  file: File,
  userId: string
): Promise<{ path: string; sizeBytes: number; mimeType: string } | null> {
  try {
    // Compress the image first
    const compressed = await compressUserImage(file);
    if (!compressed) {
      console.error("Failed to compress user image");
      return null;
    }

    const supabase = await createClient();

    // Generate a unique filename: users/{userId}-{timestamp}.jpg
    // If userId starts with "temp-", we'll rename it later when we have the real ID
    const timestamp = Date.now();
    const storagePath = `${USERS_FOLDER}/${userId}-${timestamp}.jpg`;

    // Upload compressed image to Supabase Storage
    const { data, error } = await supabase.storage
      .from(USERS_BUCKET)
      .upload(storagePath, compressed.buffer, {
        contentType: compressed.mimeType,
        upsert: false,
      });

    if (error) {
      console.error("Error uploading user image to Storage:", error);
      return null;
    }

    return {
      path: data.path,
      sizeBytes: compressed.sizeBytes,
      mimeType: compressed.mimeType,
    };
  } catch (error) {
    console.error("Error uploading user image:", error);
    return null;
  }
}

/**
 * Upload a compressed company image to Supabase Storage
 * (Storage bucket remains "organizations" for backward compatibility)
 * @param file - The image file to upload
 * @param companyId - The company ID to use in the filename
 * @returns The storage path and size if successful, null if failed
 */
export async function uploadCompanyImage(
  file: File,
  companyId: string
): Promise<{ path: string; sizeBytes: number; mimeType: string } | null> {
  try {
    // Compress the image first
    const compressed = await compressOrganizationImage(file);
    if (!compressed) {
      console.error("Failed to compress company image");
      return null;
    }

    const supabase = await createClient();

    // Generate a unique filename: organizations/{companyId}-{timestamp}.jpg
    const timestamp = Date.now();
    const storagePath = `${ORGANIZATIONS_FOLDER}/${companyId}-${timestamp}.jpg`;

    // Upload compressed image to Supabase Storage
    const { data, error } = await supabase.storage
      .from(ORGANIZATIONS_BUCKET)
      .upload(storagePath, compressed.buffer, {
        contentType: compressed.mimeType,
        upsert: false,
      });

    if (error) {
      console.error("Error uploading company image to Storage:", error);
      return null;
    }

    return {
      path: data.path,
      sizeBytes: compressed.sizeBytes,
      mimeType: compressed.mimeType,
    };
  } catch (error) {
    console.error("Error uploading company image:", error);
    return null;
  }
}

/**
 * Delete a user image from Supabase Storage
 * @param storagePath - The storage path of the file to delete
 */
export async function deleteUserImage(storagePath: string): Promise<boolean> {
  try {
    const supabase = await createClient();

    const { error } = await supabase.storage
      .from(USERS_BUCKET)
      .remove([storagePath]);

    if (error) {
      console.error("Error deleting user image from Storage:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Error deleting user image:", error);
    return false;
  }
}

/**
 * Delete a company image from Supabase Storage
 * (Storage bucket remains "organizations" for backward compatibility)
 * @param storagePath - The storage path of the file to delete
 */
export async function deleteCompanyImage(
  storagePath: string
): Promise<boolean> {
  try {
    const supabase = await createClient();

    const { error } = await supabase.storage
      .from(ORGANIZATIONS_BUCKET)
      .remove([storagePath]);

    if (error) {
      console.error("Error deleting company image from Storage:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Error deleting organization image:", error);
    return false;
  }
}

/**
 * Get a signed URL for a user image
 * @param storagePath - The storage path of the image
 * @param expiresIn - Expiration time in seconds (default: 1 hour)
 * @returns The signed URL if successful, null if failed
 */
export async function getUserImageUrl(
  storagePath: string,
  expiresIn: number = 3600
): Promise<string | null> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase.storage
      .from(USERS_BUCKET)
      .createSignedUrl(storagePath, expiresIn);

    if (error) {
      console.error("Error creating signed URL for user image:", error);
      return null;
    }

    return data.signedUrl;
  } catch (error) {
    console.error("Error getting user image URL:", error);
    return null;
  }
}

/**
 * Get a signed URL for a company image
 * @param storagePath - The storage path of the image
 * @param expiresIn - Expiration time in seconds (default: 1 hour)
 * @returns The signed URL if successful, null if failed
 */
export async function getCompanyImageUrl(
  storagePath: string,
  expiresIn: number = 3600
): Promise<string | null> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase.storage
      .from(ORGANIZATIONS_BUCKET)
      .createSignedUrl(storagePath, expiresIn);

    if (error) {
      console.error("Error creating signed URL for company image:", error);
      return null;
    }

    return data.signedUrl;
  } catch (error) {
    console.error("Error getting company image URL:", error);
    return null;
  }
}
