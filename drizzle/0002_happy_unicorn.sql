CREATE TABLE "hour_registrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"project_id" uuid,
	"description" text NOT NULL,
	"hours" numeric(10, 2) NOT NULL,
	"date" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "stage" text DEFAULT 'kick_off' NOT NULL;--> statement-breakpoint
ALTER TABLE "hour_registrations" ADD CONSTRAINT "hour_registrations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hour_registrations" ADD CONSTRAINT "hour_registrations_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;