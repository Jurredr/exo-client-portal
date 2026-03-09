ALTER TABLE "expenses" ADD COLUMN "eur_equivalent" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "exchange_rate" numeric(10, 6);--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "exchange_rate_date" timestamp;