import type { InferSelectModel } from "drizzle-orm";
import type { projects } from "@/db/schema";

export type Project = InferSelectModel<typeof projects>;
