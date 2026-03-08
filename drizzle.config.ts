import type { Config } from "drizzle-kit";
import * as dotenv from "dotenv";

// Load environment variables from .env.local (override any existing env)
dotenv.config({ path: ".env.local", override: true });

// Debug: log which DB migrations run against (host only, no secrets)
const url = process.env.DATABASE_URL;
if (url) {
  try {
    const u = new URL(url.replace("postgresql://", "https://"));
    console.log(
      "[drizzle] DATABASE_URL host:",
      u.hostname,
      "| port:",
      u.port || "5432"
    );
  } catch {
    console.log("[drizzle] DATABASE_URL set but could not parse");
  }
} else {
  console.log("[drizzle] WARNING: DATABASE_URL is not set!");
}

export default {
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
} satisfies Config;
