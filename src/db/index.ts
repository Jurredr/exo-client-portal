import { PostgresJsDatabase, drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL!;

// Disable prefetch as it is not supported for "Transaction" pool mode
// Add connection timeout and retry settings
// Use smaller pool size for Supabase free tier (Session mode has limited connections)
// NOTE: In some package manager layouts, multiple copies of `postgres` can exist,
// which makes the `Sql` type nominally incompatible (private symbol branding).
// Casting here avoids a build-time type conflict while keeping runtime behavior identical.
const client = postgres(connectionString, {
  prepare: false,
  connect_timeout: 10, // 10 seconds connection timeout
  max: 5, // Reduced pool size for Supabase free tier (Session mode limit)
  idle_timeout: 10, // Close idle connections after 10 seconds (faster cleanup)
  max_lifetime: 60 * 10, // Close connections after 10 minutes (prevent stale connections)
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
