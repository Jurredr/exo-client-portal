/**
 * Backfill NULL invoice_date values.
 * Run with: bun run migrate:invoice-date
 *
 * Uses the same DATABASE_URL as the app (.env.local).
 */
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import postgres from "postgres";

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL is not set. Ensure .env.local is loaded.");
    process.exit(1);
  }

  const sql = postgres(connectionString);

  try {
    // Step 1: Set invoice_date = due_date where invoice_date is NULL and due_date exists
    await sql`
      UPDATE invoices
      SET invoice_date = due_date
      WHERE invoice_date IS NULL AND due_date IS NOT NULL
    `;
    console.log("Step 1 done: set invoice_date = due_date where applicable");

    // Step 2: Set invoice_date = created_at for remaining NULLs
    await sql`
      UPDATE invoices
      SET invoice_date = created_at
      WHERE invoice_date IS NULL
    `;
    console.log(
      "Step 2 done: set invoice_date = created_at for remaining rows"
    );

    // Step 3: Check no NULLs remain, then make column NOT NULL
    const nullCount = await sql`
      SELECT count(*)::int as n FROM invoices WHERE invoice_date IS NULL
    `;
    if (nullCount[0].n > 0) {
      console.error(
        `Still ${nullCount[0].n} rows with NULL invoice_date. Aborting.`
      );
      process.exit(1);
    }

    await sql`ALTER TABLE invoices ALTER COLUMN invoice_date SET NOT NULL`;
    console.log("Step 3 done: column invoice_date is now NOT NULL.");
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
