import { PostgresJsDatabase, drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL!;

// Disable prefetch as it is not supported for "Transaction" pool mode
// Add connection timeout and retry settings
const drizzleClient = drizzle(
  postgres(connectionString, {
    prepare: false,
    connect_timeout: 10, // 10 seconds connection timeout
    max: 10, // Maximum number of connections
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
