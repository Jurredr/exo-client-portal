import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL!;

// Disable prefetch as it is not supported for "Transaction" pool mode
// Add connection timeout and retry settings
const client = postgres(connectionString, {
  prepare: false,
  connect_timeout: 10, // 10 seconds connection timeout
  max: 10, // Maximum number of connections
});
export const db = drizzle(client, { schema });
