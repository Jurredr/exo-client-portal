/**
 * Migration script to move existing Base64 PDFs from file_url/invoice_url columns
 * to Supabase Storage for contracts and expenses
 *
 * Run with: pnpm tsx scripts/migrate-contracts-expenses-to-storage.ts
 */

import { config } from "dotenv";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { and, eq, isNotNull, sql } from "drizzle-orm";
import * as schema from "../src/db/schema";

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

async function migrateContracts() {
  console.log("\n📄 Migrating contracts...");

  // Get all contracts with Base64 fileUrl
  const contracts = await db
    .select({
      id: schema.legalDocuments.id,
      name: schema.legalDocuments.name,
      fileUrl: schema.legalDocuments.fileUrl,
    })
    .from(schema.legalDocuments)
    .where(
      and(
        eq(schema.legalDocuments.type, "contract"),
        isNotNull(schema.legalDocuments.fileUrl),
        sql`${schema.legalDocuments.fileUrl} LIKE 'data:%'`
      )
    );

  console.log(`Found ${contracts.length} contracts with Base64 files`);

  let migrated = 0;
  let failed = 0;

  for (const contract of contracts) {
    try {
      if (!contract.fileUrl || !contract.fileUrl.startsWith("data:")) {
        continue;
      }

      // Extract base64 data
      const base64Match = contract.fileUrl.match(/^data:.*?;base64,(.+)$/);
      if (!base64Match || !base64Match[1]) {
        console.warn(`⚠️  Contract ${contract.id}: Invalid Base64 format`);
        failed++;
        continue;
      }

      const base64Data = base64Match[1];
      const buffer = Buffer.from(base64Data, "base64");
      const fileSize = buffer.length;

      // Determine file type from data URL
      const mimeTypeMatch = contract.fileUrl.match(/^data:(.*?);base64,/);
      const mimeType = mimeTypeMatch ? mimeTypeMatch[1] : "application/pdf";
      const extension = mimeType.includes("pdf") ? "pdf" : "bin";

      // Upload to Storage using service role client
      const timestamp = Date.now();
      const sanitizedFileName = `${contract.name}.${extension}`.replace(
        /[^a-zA-Z0-9.-]/g,
        "_"
      );
      const storagePath = `contracts/${contract.id}-${timestamp}-${sanitizedFileName}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("contracts")
        .upload(storagePath, buffer, {
          contentType: mimeType,
          upsert: false,
        });

      if (uploadError) {
        console.error(
          `❌ Contract ${contract.id}: Upload failed:`,
          uploadError.message
        );
        failed++;
        continue;
      }

      // Update the contract with storage path
      await db
        .update(schema.legalDocuments)
        .set({
          fileStoragePath: uploadData.path,
          fileName: `${contract.name}.${extension}`,
          fileType: mimeType,
          fileSizeBytes: fileSize,
        })
        .where(eq(schema.legalDocuments.id, contract.id));

      console.log(`✅ Contract ${contract.id}: Migrated (${fileSize} bytes)`);
      migrated++;
    } catch (error) {
      console.error(`❌ Contract ${contract.id}: Error:`, error);
      failed++;
    }
  }

  console.log(
    `\n📄 Contracts migration complete: ${migrated} migrated, ${failed} failed`
  );
}

async function migrateExpenses() {
  console.log("\n💰 Migrating expenses...");

  // Get all expenses with Base64 invoiceUrl
  const expenses = await db
    .select({
      id: schema.expenses.id,
      description: schema.expenses.description,
      invoiceUrl: schema.expenses.invoiceUrl,
      invoiceFileName: schema.expenses.invoiceFileName,
      invoiceFileType: schema.expenses.invoiceFileType,
    })
    .from(schema.expenses)
    .where(
      and(
        isNotNull(schema.expenses.invoiceUrl),
        sql`${schema.expenses.invoiceUrl} LIKE 'data:%'`
      )
    );

  console.log(`Found ${expenses.length} expenses with Base64 files`);

  let migrated = 0;
  let failed = 0;

  for (const expense of expenses) {
    try {
      if (!expense.invoiceUrl || !expense.invoiceUrl.startsWith("data:")) {
        continue;
      }

      // Extract base64 data
      const base64Match = expense.invoiceUrl.match(/^data:.*?;base64,(.+)$/);
      if (!base64Match || !base64Match[1]) {
        console.warn(`⚠️  Expense ${expense.id}: Invalid Base64 format`);
        failed++;
        continue;
      }

      const base64Data = base64Match[1];
      const buffer = Buffer.from(base64Data, "base64");
      const fileSize = buffer.length;

      // Determine file type from data URL or existing metadata
      const mimeTypeMatch = expense.invoiceUrl.match(/^data:(.*?);base64,/);
      const mimeType =
        expense.invoiceFileType ||
        (mimeTypeMatch ? mimeTypeMatch[1] : "application/pdf");
      const extension = expense.invoiceFileName
        ? expense.invoiceFileName.split(".").pop() || "pdf"
        : mimeType.includes("pdf")
          ? "pdf"
          : mimeType.includes("image")
            ? "jpg"
            : "bin";

      const fileName =
        expense.invoiceFileName || `expense-${expense.id}.${extension}`;

      // Upload to Storage
      const timestamp = Date.now();
      const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
      const storagePath = `expenses/${expense.id}-${timestamp}-${sanitizedFileName}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("expenses")
        .upload(storagePath, buffer, {
          contentType: mimeType,
          upsert: false,
        });

      if (uploadError) {
        console.error(
          `❌ Expense ${expense.id}: Upload failed:`,
          uploadError.message
        );
        failed++;
        continue;
      }

      // Update the expense with storage path
      await db
        .update(schema.expenses)
        .set({
          invoiceStoragePath: uploadData.path,
          invoiceFileName: fileName,
          invoiceFileType: mimeType,
          invoiceSizeBytes: fileSize,
        })
        .where(eq(schema.expenses.id, expense.id));

      console.log(`✅ Expense ${expense.id}: Migrated (${fileSize} bytes)`);
      migrated++;
    } catch (error) {
      console.error(`❌ Expense ${expense.id}: Error:`, error);
      failed++;
    }
  }

  console.log(
    `\n💰 Expenses migration complete: ${migrated} migrated, ${failed} failed`
  );
}

async function main() {
  console.log(
    "🚀 Starting migration of contracts and expenses to Storage...\n"
  );

  try {
    await migrateContracts();
    await migrateExpenses();

    console.log("\n✨ Migration complete!");
    console.log("\n⚠️  Next steps:");
    console.log("1. Verify that all files are accessible in Storage");
    console.log("2. Test downloading files through the API");
    console.log(
      "3. Once confirmed, create a migration to drop file_url and invoice_url columns"
    );
  } catch (error) {
    console.error("\n❌ Migration failed:", error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
