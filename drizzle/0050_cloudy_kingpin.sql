CREATE TABLE "assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"purchase_date" timestamp NOT NULL,
	"purchase_price" numeric(12, 2) NOT NULL,
	"residual_value" numeric(12, 2) DEFAULT '0' NOT NULL,
	"useful_life_years" integer DEFAULT 5 NOT NULL,
	"category" text,
	"linked_expense_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "assets_linked_expense_id_unique" UNIQUE("linked_expense_id")
);
--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_linked_expense_id_expenses_id_fk" FOREIGN KEY ("linked_expense_id") REFERENCES "public"."expenses"("id") ON DELETE set null ON UPDATE no action;