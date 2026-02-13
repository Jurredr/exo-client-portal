/**
 * Generate a short unique suffix (8 chars) for slugs.
 * Uses crypto for new projects where we don't have an id yet.
 */
export function generateSlugSuffix(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  }
  return Math.random().toString(36).slice(2, 10);
}

/**
 * Generate a URL-safe slug from a title.
 * Optionally append a suffix (e.g. short id) to guarantee uniqueness.
 */
export function slugify(title: string, uniqueSuffix?: string): string {
  const base = title
    .trim()
    .replace(/[^a-zA-Z0-9\s]/g, "")
    .replace(/\s+/g, "-")
    .toLowerCase()
    .replace(/^-+|-+$/g, "");

  const slug = base
    ? `${base}${uniqueSuffix ? `-${uniqueSuffix}` : ""}`
    : (uniqueSuffix ?? "");
  return slug || "project";
}
