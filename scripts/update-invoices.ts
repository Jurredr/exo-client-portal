/**
 * Script to update invoices and invoice_line_items tables with new data from backup files
 * 
 * Usage:
 *   pnpm tsx scripts/update-invoices.ts
 * 
 * This script will:
 * 1. Delete all existing invoice_line_items (due to foreign key constraints)
 * 2. Delete all existing invoices
 * 3. Import new data from invoices_rows.sql
 * 4. Import new data from invoice_line_items_rows.sql
 * 
 * Make sure your .env.local has the correct DATABASE_URL for your Supabase instance
 */

import postgres from "postgres";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

// Load environment variables from .env.local
dotenv.config({ path: ".env.local" });

const __dirname = path.resolve();

// Load environment variables
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("❌ DATABASE_URL environment variable is not set!");
  console.error("Please set DATABASE_URL in your .env.local file");
  process.exit(1);
}

const sql = postgres(connectionString, {
  max: 1, // Use single connection for imports
});

const backupDir = path.join(__dirname, "EXO_supabase_backup");

async function importFile(filename: string) {
  const filePath = path.join(backupDir, filename);
  
  if (!fs.existsSync(filePath)) {
    console.error(`❌ File not found: ${filename}`);
    throw new Error(`File not found: ${filename}`);
  }

  const fileSize = fs.statSync(filePath).size;
  const fileSizeMB = (fileSize / (1024 * 1024)).toFixed(2);
  console.log(`📥 Importing ${filename} (${fileSizeMB} MB)...`);
  
  try {
    const sqlContent = fs.readFileSync(filePath, "utf-8");
    
    // Handle files that might have multiple INSERT statements
    // Split by semicolon followed by newline or end of string
    const statements = sqlContent
      .split(/;\s*(?=\n|$)/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && s.toUpperCase().startsWith("INSERT"));

    if (statements.length === 0) {
      console.log(`   ℹ️  No INSERT statements found in ${filename}`);
      return;
    }

    console.log(`   Processing ${statements.length} INSERT statement(s)...`);

    let successCount = 0;
    let duplicateCount = 0;
    let errorCount = 0;

    // Execute each INSERT statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      try {
        await sql.unsafe(statement + ";");
        successCount++;
        
        // Progress indicator for large files
        if (statements.length > 100 && (i + 1) % 100 === 0) {
          console.log(`   Progress: ${i + 1}/${statements.length} statements processed...`);
        }
      } catch (error: any) {
        // Ignore duplicate key errors (data might already exist)
        if (error?.code === "23505") {
          duplicateCount++;
        } else {
          errorCount++;
          console.error(`   ❌ Error on statement ${i + 1}:`, error.message);
          // Continue processing other statements
        }
      }
    }

    console.log(`   ✅ Successfully imported ${filename}`);
    if (successCount > 0) console.log(`      ✓ ${successCount} statements executed`);
    if (duplicateCount > 0) console.log(`      ⚠️  ${duplicateCount} duplicates skipped`);
    if (errorCount > 0) console.log(`      ❌ ${errorCount} errors encountered`);
  } catch (error: any) {
    console.error(`   ❌ Error importing ${filename}:`, error.message);
    throw error;
  }
}

async function main() {
  console.log("🚀 Starting invoice data update...\n");
  console.log("⚠️  WARNING: This will delete all existing invoices and invoice_line_items!");
  console.log("   Press Ctrl+C to cancel, or wait 3 seconds to continue...\n");

  // Give user a moment to cancel
  await new Promise((resolve) => setTimeout(resolve, 3000));

  try {
    // Test connection
    await sql`SELECT 1`;
    console.log("✅ Database connection successful\n");

    // Step 1: Delete invoice_line_items first (due to foreign key constraints)
    console.log("🗑️  Deleting existing invoice_line_items...");
    const deletedLineItems = await sql`DELETE FROM invoice_line_items`;
    console.log(`   ✅ Deleted ${deletedLineItems.count || 0} invoice_line_items\n`);

    // Step 2: Delete invoices
    console.log("🗑️  Deleting existing invoices...");
    const deletedInvoices = await sql`DELETE FROM invoices`;
    console.log(`   ✅ Deleted ${deletedInvoices.count || 0} invoices\n`);

    // Step 3: Import new invoices
    console.log("📥 Importing new invoices...\n");
    await importFile("invoices_rows.sql");

    // Step 4: Import new invoice_line_items
    console.log("\n📥 Importing new invoice_line_items...\n");
    await importFile("invoice_line_items_rows.sql");

    console.log("\n✅ Invoice data update completed successfully!");
  } catch (error: any) {
    console.error("\n❌ Update failed:", error.message);
    console.error("\n⚠️  Note: Some data may have been deleted. You may need to restore from backup.");
    process.exit(1);
  } finally {
    await sql.end();
  }
}

main();
