import { PostgresJsDatabase, drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL!;

// Disable prefetch as it is not supported for "Transaction" pool mode
// Add connection timeout and retry settings
// Increase pool size and add idle timeout to prevent connection exhaustion
const drizzleClient = drizzle(
  postgres(connectionString, {
    prepare: false,
    connect_timeout: 10, // 10 seconds connection timeout
    max: 20, // Maximum number of connections (increased to handle more concurrent requests)
    idle_timeout: 20, // Close idle connections after 20 seconds
    max_lifetime: 60 * 30, // Close connections after 30 minutes
  }),
  { schema }
);

// Cache the database connection in development to prevent connection timeouts
// This prevents Next.js from creating new connections on every hot reload
declare global {
  var database: PostgresJsDatabase<typeof schema> | undefined;
}

export const db = global.database || drizzleClient;

if (process.env.NODE_ENV !== "production") {
  global.database = db;
}
