/**
 * Script to import data from SQL backup files into the new Supabase database
 * 
 * Usage:
 *   pnpm tsx scripts/import-backup.ts
 * 
 * Make sure your .env.local has the correct DATABASE_URL for the new Supabase instance
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

// Order matters - import tables in dependency order
const importOrder = [
  "organizations_rows.sql",
  "users_rows.sql",
  "user_organizations_rows.sql",
  "projects_rows.sql",
  "hour_registrations_rows.sql",
  "expenses_rows.sql",
  "legal_documents_rows.sql",
  "contract_projects_rows.sql",
  "invoices_rows.sql",
  "invoice_line_items_rows.sql",
];

async function importFile(filename: string) {
  const filePath = path.join(backupDir, filename);
  
  if (!fs.existsSync(filePath)) {
    console.warn(`⚠️  File not found: ${filename}`);
    return;
  }

  const fileSize = fs.statSync(filePath).size;
  const fileSizeMB = (fileSize / (1024 * 1024)).toFixed(2);
  console.log(`📥 Importing ${filename} (${fileSizeMB} MB)...`);
  
  try {
    // For large files, read in chunks and process line by line
    const sqlContent = fs.readFileSync(filePath, "utf-8");
    
    // Handle files that might have multiple INSERT statements on one line
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
          // For non-duplicate errors, we might want to continue or stop
          // Uncomment the next line if you want to stop on errors:
          // throw error;
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
  console.log("🚀 Starting data import from backup files...\n");

  try {
    // Test connection
    await sql`SELECT 1`;
    console.log("✅ Database connection successful\n");

    // Import files in order
    for (const filename of importOrder) {
      await importFile(filename);
    }

    console.log("\n✅ All data imported successfully!");
  } catch (error: any) {
    console.error("\n❌ Import failed:", error.message);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

main();
