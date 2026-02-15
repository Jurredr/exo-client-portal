import { PostgresJsDatabase, drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL!;

// Serverless: use max 1 connection per instance to avoid exhausting Supabase pool.
// Each Vercel function can spawn its own pool; with max: 5 × many instances = connection limit.
// Use Supabase "Transaction" pooler (port 6543) in DATABASE_URL for serverless - see
// Dashboard > Project Settings > Database > Connection string > URI (Transaction pooler).
const client = postgres(connectionString, {
  prepare: false,
  connect_timeout: 10,
  max: 1,
  idle_timeout: 10,
  max_lifetime: 60 * 5,
});

// `postgres` can be duplicated in some install layouts, making its `Sql` type
// nominally incompatible with Drizzle's expected `Sql`. This cast is runtime-safe.
const drizzleClient = drizzle(client as never, { schema });

// Cache the database connection in development to prevent connection timeouts
// This prevents Next.js from creating new connections on every hot reload
declare global {
  var database: PostgresJsDatabase<typeof schema> | undefined;
}

export const db = global.database || drizzleClient;

if (process.env.NODE_ENV !== "production") {
  global.database = db;
}
