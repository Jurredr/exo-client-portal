/**
 * Migration script to move existing Base64 images from image columns
 * to Supabase Storage for users and organizations
 *
 * Run with: pnpm tsx scripts/migrate-images-to-storage.ts
 */

import { config } from "dotenv";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { and, eq, isNotNull, sql } from "drizzle-orm";
import * as schema from "../src/db/schema";
// Note: We use sharp directly in this script since File/Blob APIs aren't available in Node.js

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const databaseUrl = process.env.DATABASE_URL;

if (!supabaseUrl || !supabaseServiceKey || !databaseUrl) {
  console.error("Missing required environment variables:");
  console.error("- NEXT_PUBLIC_SUPABASE_URL:", !!supabaseUrl);
  console.error("- SUPABASE_SERVICE_ROLE_KEY:", !!supabaseServiceKey);
  console.error("- DATABASE_URL:", !!databaseUrl);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);
const client = postgres(databaseUrl);
const db = drizzle(client, { schema });

async function migrateUserImages() {
  console.log("\n👤 Migrating user images...");

  // Get all users with Base64 images
  const users = await db
    .select({
      id: schema.users.id,
      email: schema.users.email,
      name: schema.users.name,
      image: schema.users.image,
    })
    .from(schema.users)
    .where(
      and(
        isNotNull(schema.users.image),
        sql`${schema.users.image} LIKE 'data:%'`
      )
    );

  console.log(`Found ${users.length} users with Base64 images`);

  let migrated = 0;
  let failed = 0;

  for (const user of users) {
    try {
      if (!user.image || !user.image.startsWith("data:")) {
        continue;
      }

      // Extract base64 data
      const base64Match = user.image.match(/^data:.*?;base64,(.+)$/);
      if (!base64Match || !base64Match[1]) {
        console.warn(`⚠️  User ${user.id}: Invalid Base64 format`);
        failed++;
        continue;
      }

      const base64Data = base64Match[1];
      const inputBuffer = Buffer.from(base64Data, "base64");
      const originalSize = inputBuffer.length;

      // Determine file type from data URL
      const mimeTypeMatch = user.image.match(/^data:(.*?);base64,/);
      const mimeType = mimeTypeMatch ? mimeTypeMatch[1] : "image/jpeg";

      // Compress the image using sharp directly (Node.js compatible)
      const sharp = (await import("sharp")).default;
      let compressedBuffer: Buffer;
      let outputMimeType: string;

      try {
        const sharpInstance = sharp(inputBuffer).resize(400, 400, {
          fit: "inside",
          withoutEnlargement: true,
        });

        // Convert to JPEG for consistency
        compressedBuffer = await sharpInstance
          .jpeg({ quality: 80, mozjpeg: true })
          .toBuffer();
        outputMimeType = "image/jpeg";
      } catch (error) {
        console.warn(`⚠️  User ${user.id}: Failed to compress image:`, error);
        failed++;
        continue;
      }

      // Upload to Storage
      const timestamp = Date.now();
      const storagePath = `users/${user.id}-${timestamp}.jpg`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("users")
        .upload(storagePath, compressedBuffer, {
          contentType: outputMimeType,
          upsert: false,
        });

      if (uploadError) {
        console.error(
          `❌ User ${user.id}: Upload failed:`,
          uploadError.message
        );
        failed++;
        continue;
      }

      // Update the user with storage path
      await db
        .update(schema.users)
        .set({
          imageStoragePath: uploadData.path,
          imageSizeBytes: compressedBuffer.length,
        })
        .where(eq(schema.users.id, user.id));

      console.log(
        `✅ User ${user.id}: Migrated (${compressedBuffer.length} bytes, compressed from ${originalSize} bytes)`
      );
      migrated++;
    } catch (error) {
      console.error(`❌ User ${user.id}: Error:`, error);
      failed++;
    }
  }

  console.log(
    `\n👤 User images migration complete: ${migrated} migrated, ${failed} failed`
  );
}

async function migrateOrganizationImages() {
  console.log("\n🏢 Migrating organization images...");

  // Get all organizations with Base64 images
  const organizations = await db
    .select({
      id: schema.organizations.id,
      name: schema.organizations.name,
      image: schema.organizations.image,
    })
    .from(schema.organizations)
    .where(
      and(
        isNotNull(schema.organizations.image),
        sql`${schema.organizations.image} LIKE 'data:%'`
      )
    );

  console.log(`Found ${organizations.length} organizations with Base64 images`);

  let migrated = 0;
  let failed = 0;

  for (const org of organizations) {
    try {
      if (!org.image || !org.image.startsWith("data:")) {
        continue;
      }

      // Extract base64 data
      const base64Match = org.image.match(/^data:.*?;base64,(.+)$/);
      if (!base64Match || !base64Match[1]) {
        console.warn(`⚠️  Organization ${org.id}: Invalid Base64 format`);
        failed++;
        continue;
      }

      const base64Data = base64Match[1];
      const inputBuffer = Buffer.from(base64Data, "base64");
      const originalSize = inputBuffer.length;

      // Determine file type from data URL
      const mimeTypeMatch = org.image.match(/^data:(.*?);base64,/);
      const mimeType = mimeTypeMatch ? mimeTypeMatch[1] : "image/jpeg";

      // Compress the image using sharp directly (Node.js compatible)
      const sharp = (await import("sharp")).default;
      let compressedBuffer: Buffer;
      let outputMimeType: string;

      try {
        const sharpInstance = sharp(inputBuffer).resize(600, 600, {
          fit: "inside",
          withoutEnlargement: true,
        });

        // Convert to JPEG for consistency
        compressedBuffer = await sharpInstance
          .jpeg({ quality: 85, mozjpeg: true })
          .toBuffer();
        outputMimeType = "image/jpeg";
      } catch (error) {
        console.warn(
          `⚠️  Organization ${org.id}: Failed to compress image:`,
          error
        );
        failed++;
        continue;
      }

      // Upload to Storage
      const timestamp = Date.now();
      const storagePath = `organizations/${org.id}-${timestamp}.jpg`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("organizations")
        .upload(storagePath, compressedBuffer, {
          contentType: outputMimeType,
          upsert: false,
        });

      if (uploadError) {
        console.error(
          `❌ Organization ${org.id}: Upload failed:`,
          uploadError.message
        );
        failed++;
        continue;
      }

      // Update the organization with storage path
      await db
        .update(schema.organizations)
        .set({
          imageStoragePath: uploadData.path,
          imageSizeBytes: compressedBuffer.length,
        })
        .where(eq(schema.organizations.id, org.id));

      console.log(
        `✅ Organization ${org.id}: Migrated (${compressedBuffer.length} bytes, compressed from ${originalSize} bytes)`
      );
      migrated++;
    } catch (error) {
      console.error(`❌ Organization ${org.id}: Error:`, error);
      failed++;
    }
  }

  console.log(
    `\n🏢 Organization images migration complete: ${migrated} migrated, ${failed} failed`
  );
}

async function main() {
  console.log(
    "🚀 Starting migration of user and organization images to Storage...\n"
  );

  try {
    await migrateUserImages();
    await migrateOrganizationImages();

    console.log("\n✨ Migration complete!");
    console.log("\n⚠️  Next steps:");
    console.log("1. Verify that all images are accessible in Storage");
    console.log("2. Test displaying images in the UI");
    console.log("3. Once confirmed, create a migration to drop image columns");
  } catch (error) {
    console.error("\n❌ Migration failed:", error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
