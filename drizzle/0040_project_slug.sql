-- Add slug column (nullable first for backfill)
ALTER TABLE "projects" ADD COLUMN "slug" text;
--> statement-breakpoint
-- Generate slugs: slugify(title) + '-' + first 8 chars of id (without hyphens)
UPDATE "projects" SET "slug" = (
  COALESCE(
    NULLIF(
      TRIM(REGEXP_REPLACE(
        REGEXP_REPLACE(LOWER(TRIM("title")), '[^a-z0-9\s]', '', 'g'),
        '\s+', '-', 'g'
      )),
      ''
    ) || '-',
    ''
  ) || REPLACE(SUBSTRING("id"::text, 1, 8), '-', '')
)
WHERE "slug" IS NULL;
--> statement-breakpoint
-- Fallback for empty titles: use id prefix only
UPDATE "projects" SET "slug" = REPLACE(SUBSTRING("id"::text, 1, 8), '-', '')
WHERE "slug" = '' OR "slug" LIKE '-%';
--> statement-breakpoint
ALTER TABLE "projects" ALTER COLUMN "slug" SET NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "projects_slug_unique" ON "projects" ("slug");
